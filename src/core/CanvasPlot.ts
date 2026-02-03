// tsplot/src/core/CanvasPlot.ts

import { resizeCanvasToDisplaySize } from "./resize";
// [NEW]
import { parseTimandaTsplotJson } from "../data/parse";
import type { TimandaMtsV1 } from "../data/timanda_schema";

export type CanvasPlotOptions = {
  background?: string;
};

export class CanvasPlot {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ro: ResizeObserver | null = null;

  private options: Required<CanvasPlotOptions>;

  // [NEW] Trzymamy pełne dane z timandy w bibliotece, nie w window ani w aplikacji
  private data: TimandaMtsV1 | null = null;

  constructor(canvas: HTMLCanvasElement, options: CanvasPlotOptions = {}) {
    this.canvas = canvas;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("CanvasPlot: could not acquire 2D context.");
    }
    this.ctx = ctx;

    this.options = {
      background: options.background ?? "#ffffff",
    };

    this.ro = new ResizeObserver(() => this.render());
    this.ro.observe(this.canvas);

    this.render();
  }

  setOptions(partial: CanvasPlotOptions) {
    this.options = { ...this.options, ...partial };
    this.render();
  }

  // [NEW] Publiczne API do podania pełnego JSON-a timandy
  setData(raw: unknown) {
    const parsed = parseTimandaTsplotJson(raw);

    // W tym momencie obsługujemy tylko MTS v1
    this.data = parsed as TimandaMtsV1;

    this.render();
  }

  /**
   * Fetch JSON from `url` and set it as the plot data.
   * Convenience helper to keep calling code minimal.
   */
  async loadFromUrl(url: string): Promise<void> {
    const resp = await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) throw new Error(`Failed to load ${url}: ${resp.status} ${resp.statusText}`);
    const raw = await resp.json();
    this.setData(raw);
  }

  /**
   * Create a CanvasPlot from a canvas element or element id.
   * Accepts either an `HTMLCanvasElement` or a string id.
   */
  static create(canvasOrId: string | HTMLCanvasElement, options: CanvasPlotOptions = {}): CanvasPlot {
    const canvas = typeof canvasOrId === "string" ? document.getElementById(canvasOrId) as HTMLCanvasElement : canvasOrId;
    if (!canvas) throw new Error("CanvasPlot.create: canvas element not found");
    return new CanvasPlot(canvas, options);
  }

  /**
   * Attach a button to trigger loading data. `urlProvider` should return the URL to fetch.
   * Optional `statusEl` will receive simple status messages.
   */
  // NOTE: UI helpers intentionally omitted from the library to keep it UI-agnostic.

  render() {
    const { displayWidth, displayHeight, dpr } = resizeCanvasToDisplaySize(this.canvas);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, displayWidth, displayHeight);
  
    // tło
    this.ctx.fillStyle = this.options.background;
    this.ctx.fillRect(0, 0, displayWidth, displayHeight);
  
    const segments = this.data?.segments;
    if (!segments || segments.length === 0) return;
  
    // 1) Globalne min/max po wszystkich segmentach
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    let haveAnyPoint = false;
  
    for (const seg of segments) {
      const x_tab = seg?.mjd;
      const y_tab = seg?.val;
      if (!Array.isArray(x_tab) || !Array.isArray(y_tab)) continue;
  
      const n = Math.min(x_tab.length, y_tab.length);
      for (let i = 0; i < n; i++) {
        const x = x_tab[i];
        const y = y_tab[i];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        haveAnyPoint = true;
        if (x < xmin) xmin = x;
        if (x > xmax) xmax = x;
        if (y < ymin) ymin = y;
        if (y > ymax) ymax = y;
      }
    }
  
    if (!haveAnyPoint) return;
  
    const dx = (xmax - xmin) || 1;
    const dy = (ymax - ymin) || 1;
  
    // --- [NEW] globalny obszar liniowy robust z wagami i odrzucaniem segmentów pikowych ---
    // - segmenty "pikowe" (duży spike_fraction) nie wpływają na pasmo
    // - typowy center i width liczone ważoną medianą (waga ~ sqrt(n))
    // - globalLow/globalHigh liczone ważonymi percentylami (np. 5% i 95%), nie min/max

    type BandItem = {
      center: number;
      width: number;      // pad * linthresh
      low: number;
      high: number;
      w: number;          // waga
      spike: number;      // spike_fraction
    };

    const pad = 2;
    const items: BandItem[] = [];

    for (const seg of segments) {
      const yStats = (seg as any)?.stats?.y;
      if (!yStats) continue;

      const center = yStats.center;
      const linthresh = yStats.linthresh;
      const spike = yStats.spike_fraction;
      const n = yStats.n;

      if (!Number.isFinite(center) || !Number.isFinite(linthresh)) continue;
      if (!Number.isFinite(spike)) continue;
      if (!Number.isFinite(n) || n <= 0) continue;

      const width = pad * linthresh;
      const low = center - width;
      const high = center + width;

      // waga: sqrt(n) jest stabilna (n bywa gigantyczne)
      const w = Math.sqrt(n);

      items.push({ center, width, low, high, w, spike });
    }

    function weightedMedian(values: number[], weights: number[]): number {
      const arr = values.map((v, i) => ({ v, w: weights[i] }))
        .filter((a) => Number.isFinite(a.v) && Number.isFinite(a.w) && a.w > 0)
        .sort((a, b) => a.v - b.v);

      const total = arr.reduce((s, a) => s + a.w, 0);
      let acc = 0;
      for (const a of arr) {
        acc += a.w;
        if (acc >= 0.5 * total) return a.v;
      }
      return arr.length ? arr[arr.length - 1].v : NaN;
    }

    // q w [0..1]
    function weightedQuantile(values: number[], weights: number[], q: number): number {
      const arr = values.map((v, i) => ({ v, w: weights[i] }))
        .filter((a) => Number.isFinite(a.v) && Number.isFinite(a.w) && a.w > 0)
        .sort((a, b) => a.v - b.v);

      const total = arr.reduce((s, a) => s + a.w, 0);
      const target = q * total;
      let acc = 0;
      for (const a of arr) {
        acc += a.w;
        if (acc >= target) return a.v;
      }
      return arr.length ? arr[arr.length - 1].v : NaN;
    }

    let globalLow = Infinity;
    let globalHigh = -Infinity;
    let haveGlobalBand = false;

    if (items.length > 0) {
      // 1) odrzuć segmenty bardzo pikowe (niech nie wpływają na pasmo)
      const spikeMax = 0.20; // startowo 0.2, dostrój wg danych
      const good = items.filter((it) => it.spike <= spikeMax);

      const base = good.length >= 3 ? good : items; // fallback: jakby wszystko odpadło

      const centers = base.map((it) => it.center);
      const widths = base.map((it) => it.width);
      const ws = base.map((it) => it.w);

      const C = weightedMedian(centers, ws);
      const W = weightedMedian(widths, ws);
      const Wsafe = Math.max(1e-12, W);

      // 2) inliery: center blisko typowego (3×typowa szerokość)
      const thr = 3 * Wsafe;
      const inliers = base.filter((it) => Math.abs(it.center - C) <= thr);

      const used = inliers.length >= 2 ? inliers : base;

      // 3) global band: ważone percentyle low/high (stabilniejsze niż min/max)
      const lows = used.map((it) => it.low);
      const highs = used.map((it) => it.high);
      const wUsed = used.map((it) => it.w);

      globalLow = weightedQuantile(lows, wUsed, 0.05);
      globalHigh = weightedQuantile(highs, wUsed, 0.95);

      haveGlobalBand = Number.isFinite(globalLow) && Number.isFinite(globalHigh) && (globalHigh > globalLow);
    }

    if (!haveGlobalBand) {
      globalLow = ymin;
      globalHigh = ymax;
    }
    // --- [/NEW] koniec globalnego pasma liniowego ---


    // layout (zostawiam jak było)
    const marginLeft = 100;
    const marginBottom = 50;
    const marginTop = 10;
    const marginRight = 10;
  
    const plotArea = {
      x: marginLeft,
      y: marginTop,
      w: Math.max(1, displayWidth - marginLeft - marginRight),
      h: Math.max(1, displayHeight - marginTop - marginBottom)
    };
  
    const leftArea = {
      x: 0,
      y: marginTop,
      w: marginLeft,
      h: plotArea.h
    };
  
    const bottomArea = {
      x: marginLeft,
      y: plotArea.y + plotArea.h,
      w: plotArea.w,
      h: marginBottom
    };
  
    const xToPx = (x: number) => plotArea.x + ((x - xmin) / dx) * plotArea.w;

    // --- [NEW] hybrydowa oś Y: linear w [globalLow, globalHigh], symlog poza ---
    const yCenter = 0.5 * (globalLow + globalHigh);

    // Granica liniowości = dokładnie globalny pas
    const L0 = Math.max(1e-12, 0.5 * (globalHigh - globalLow));

    // Kompresja ogonów: <1 => ogony mniejsze, liniowy „większy” wizualnie
    const tailCompress = 0.25; // spróbuj 0.5, ewentualnie 0.3
    const logScale = L0 * tailCompress;

    const yToT = (y: number) => {
      const d = y - yCenter;
      const ad = Math.abs(d);
      if (ad <= L0) return d;
      return Math.sign(d) * (L0 + Math.log10(ad / L0) * logScale);
    };


    const tMin = yToT(ymin);
    const tMax = yToT(ymax);
    const tSpan = (tMax - tMin) || 1;

    const yToPx = (y: number) => {
      const t = yToT(y);
      const u = (t - tMin) / tSpan; // 0..1
      return plotArea.y + (1 - u) * plotArea.h;
    };

  
    const ctx = this.ctx;
  
    // ramka
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.strokeRect(plotArea.x, plotArea.y, plotArea.w, plotArea.h);

    // --- [NEW] podświetlenie obszarów logarytmicznych (poza globalLow/globalHigh) ---
    {
      const yHighPx = yToPx(globalHigh); // górna granica pasma liniowego
      const yLowPx = yToPx(globalLow);   // dolna granica pasma liniowego

      // clamp do plotArea
      const topY = plotArea.y;
      const bottomY = plotArea.y + plotArea.h;

      const yHighClamped = Math.min(Math.max(yHighPx, topY), bottomY);
      const yLowClamped = Math.min(Math.max(yLowPx, topY), bottomY);

      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.06)"; // lekko szary

      // obszar nad pasmem (log górny)
      const topH = Math.max(0, yHighClamped - topY);
      if (topH > 0) {
        ctx.fillRect(plotArea.x, topY, plotArea.w, topH);
      }

      // obszar pod pasmem (log dolny)
      const bottomH = Math.max(0, bottomY - yLowClamped);
      if (bottomH > 0) {
        ctx.fillRect(plotArea.x, yLowClamped, plotArea.w, bottomH);
      }

      ctx.restore();

      // ramka jeszcze raz, żeby nie zszarzała krawędź
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 1;
      ctx.strokeRect(plotArea.x, plotArea.y, plotArea.w, plotArea.h);
    }

  
    // osie (jak było)
    let ticks = 5;
    const tickLen = 6;
    const fmt = (v: number, span: number) => {
      const absSpan = Math.abs(span);
      if (absSpan >= 1e6) return v.toExponential(3);
      if (absSpan >= 1e3) return v.toFixed(2);
      if (absSpan >= 1) return v.toFixed(4);
      return v.toExponential(3);
    };
  
    ctx.fillStyle = "#222";
    ctx.font = "12px sans-serif";
  
    // X ticks
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i < ticks; i++) {
      const t = ticks === 1 ? 0 : i / (ticks - 1);
      const xVal = xmin + t * dx;
      const xPx = plotArea.x + t * plotArea.w;
  
      ctx.beginPath();
      ctx.moveTo(xPx, plotArea.y + plotArea.h);
      ctx.lineTo(xPx, plotArea.y + plotArea.h + tickLen);
      ctx.strokeStyle = "#444";
      ctx.stroke();
  
      ctx.fillText(fmt(xVal, dx), xPx, bottomArea.y + 6);
    }
  
    // Y ticks
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i < ticks; i++) {
      const t = ticks === 1 ? 0 : i / (ticks - 1);
      const yVal = ymin + t * dy;
      const yPx = plotArea.y + (1 - t) * plotArea.h;
  
      ctx.beginPath();
      ctx.moveTo(plotArea.x - tickLen, yPx);
      ctx.lineTo(plotArea.x, yPx);
      ctx.strokeStyle = "#444";
      ctx.stroke();
  
      ctx.fillText(fmt(yVal, dy), leftArea.x + leftArea.w - 6, yPx);
    }
  
    // 2) Rysowanie wszystkich segmentów jako jeden „wykres z przerwami”
    //    (przerwy wynikają z tego, że każdy segment to osobna ścieżka)
    ctx.strokeStyle = "#111";   // jeden kolor
    ctx.lineWidth = 1;
  
    for (const seg of segments) {
      const x_tab = seg?.mjd;
      const y_tab = seg?.val;
      if (!Array.isArray(x_tab) || !Array.isArray(y_tab)) continue;
  
      const n = Math.min(x_tab.length, y_tab.length);
      if (n < 2) continue;

          // --- [NEW] progi liniowe (linear_low / linear_high) dla tego segmentu ---
          const stats = (seg as any).stats;
          const yStats = stats?.y;
          const xStats = stats?.x;
          
          const center = yStats?.center;
          const linthresh = yStats?.linthresh;
          const segXmin = xStats?.min_mjd;
          const segXmax = xStats?.max_mjd;
          
          if (
            Number.isFinite(center) &&
            Number.isFinite(linthresh) &&
            Number.isFinite(segXmin) &&
            Number.isFinite(segXmax)
          ) {
            const lin2 = 2 * linthresh;
          
            const low = center - lin2;
            const high = center + lin2;
          
            const x0 = xToPx(segXmin);
            const x1 = xToPx(segXmax);
            const yLowPx = yToPx(low);
            const yHighPx = yToPx(high);
          
            ctx.save();
            ctx.strokeStyle = "#ff0000";
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 4]);
          
            ctx.beginPath();
            ctx.moveTo(x0, yLowPx);
            ctx.lineTo(x1, yLowPx);
            ctx.stroke();
          
            ctx.beginPath();
            ctx.moveTo(x0, yHighPx);
            ctx.lineTo(x1, yHighPx);
            ctx.stroke();
          
            ctx.restore();
          }
          
      // --- [/NEW] ---
  
      let started = false;
      ctx.beginPath();
  
      for (let i = 0; i < n; i++) {
        const x = x_tab[i];
        const y = y_tab[i];
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          // jeśli w segmencie pojawi się dziura, rozbijamy ścieżkę
          started = false;
          continue;
        }
  
        const px = xToPx(x);
        const py = yToPx(y);
  
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
  
      if (started) ctx.stroke();
    }
  }
  

  destroy() {
    this.ro?.disconnect();
    this.ro = null;
  }
}
