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
    const yToPx = (y: number) => plotArea.y + (1 - ((y - ymin) / dy)) * plotArea.h;
  
    const ctx = this.ctx;
  
    // ramka
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.strokeRect(plotArea.x, plotArea.y, plotArea.w, plotArea.h);
  
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
