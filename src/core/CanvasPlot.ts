import { resizeCanvasToDisplaySize } from "./resize";

export type CanvasPlotOptions = {
  background?: string;
};

export class CanvasPlot {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ro: ResizeObserver | null = null;

  private options: Required<CanvasPlotOptions>;

  constructor(canvas: HTMLCanvasElement, options: CanvasPlotOptions = {}) {
    this.canvas = canvas;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("CanvasPlot: could not acquire 2D context.");
    }
    this.ctx = ctx;

    this.options = {
      background: options.background ?? "#ffffff"
    };

    this.ro = new ResizeObserver(() => this.render());
    this.ro.observe(this.canvas);

    this.render();
  }

  setOptions(partial: CanvasPlotOptions) {
    this.options = { ...this.options, ...partial };
    this.render();
  }

  render() {
    const { displayWidth, displayHeight, dpr } = resizeCanvasToDisplaySize(this.canvas);
  
    // Drawing scale for high-DPI screens
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  
    // background
    this.ctx.clearRect(0, 0, displayWidth, displayHeight);
    this.ctx.fillStyle = this.options.background;
    this.ctx.fillRect(0, 0, displayWidth, displayHeight);
  
    // data
    const data = (window as any).andaData as { x_tab: number[]; y_tab: number[] } | undefined;
    if (!data?.x_tab?.length || !data?.y_tab?.length) return;
  
    const n = Math.min(data.x_tab.length, data.y_tab.length);
    if (n < 2) return;
  
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = data.x_tab[i];
      const y = data.y_tab[i];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
    if (!Number.isFinite(xmin) || !Number.isFinite(xmax) || !Number.isFinite(ymin) || !Number.isFinite(ymax)) return;
  
    const dx = (xmax - xmin) || 1;
    const dy = (ymax - ymin) || 1;
  
    // --- divide to areas ---
    const marginLeft = 100;
    const marginBottom = 50;
    const marginTop = 10;
    const marginRight = 10;
  
    const plotArea = {
      x: marginLeft,
      y: marginTop,
      w: Math.max(1, displayWidth - marginLeft - marginRight),
      h: Math.max(1, displayHeight - marginTop - marginBottom),
    };
  
    const leftArea = {
      x: 0,
      y: marginTop,
      w: marginLeft,
      h: plotArea.h,
    };
  
    const bottomArea = {
      x: marginLeft,
      y: plotArea.y + plotArea.h,
      w: plotArea.w,
      h: marginBottom,
    };
  
    // map data coords to pixel coords in plotArea
    const xToPx = (x: number) => plotArea.x + ((x - xmin) / dx) * plotArea.w;
    const yToPx = (y: number) => plotArea.y + (1 - (y - ymin) / dy) * plotArea.h;
  
    // --- axes ---
    const ctx = this.ctx;
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.strokeRect(plotArea.x, plotArea.y, plotArea.w, plotArea.h);
  
    // ticks and labels
    const ticks: number = 5;
    const tickLen = 6;
  
    // number formatting
    const fmt = (v: number, span: number) => {
      // for very large/small spans use exponential
      const absSpan = Math.abs(span);
      if (absSpan >= 1e6) return v.toExponential(3);
      if (absSpan >= 1e3) return v.toFixed(2);
      if (absSpan >= 1)   return v.toFixed(4);
      return v.toExponential(3);
    };
  
    ctx.fillStyle = "#222";
    ctx.font = "12px sans-serif";
  
    // X (dół): kreski na dole plotArea + liczby w bottomArea
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
  
    for (let i = 0; i < ticks; i++) {
      const t = (ticks === 1) ? 0 : i / (ticks - 1);
      const xVal = xmin + t * dx;
      const xPx = plotArea.x + t * plotArea.w;
  
      // kreska (tick) na dolnej krawędzi plotArea
      ctx.beginPath();
      ctx.moveTo(xPx, plotArea.y + plotArea.h);
      ctx.lineTo(xPx, plotArea.y + plotArea.h + tickLen);
      ctx.strokeStyle = "#444";
      ctx.stroke();
  
      // liczba w bottomArea (lekki odstęp od ticka)
      const label = fmt(xVal, dx);
      const labelY = bottomArea.y + 6; // padding w bottomArea
      ctx.fillText(label, xPx, labelY);
    }
  
    // Y (lewo): kreski na lewej krawędzi plotArea + liczby w leftArea
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
  
    for (let i = 0; i < ticks; i++) {
      const t = (ticks === 1) ? 0 : i / (ticks - 1);
      const yVal = ymin + t * dy;
  
      // pamiętaj: na ekranie większe y jest niżej, więc pikselowo odwracamy
      const yPx = plotArea.y + (1 - t) * plotArea.h;
  
      // kreska na lewej krawędzi plotArea
      ctx.beginPath();
      ctx.moveTo(plotArea.x - tickLen, yPx);
      ctx.lineTo(plotArea.x, yPx);
      ctx.strokeStyle = "#444";
      ctx.stroke();
  
      // liczba w leftArea (wyrównana do prawej, blisko plotArea.x)
      const label = fmt(yVal, dy);
      const labelX = leftArea.x + leftArea.w - 6; // padding od krawędzi
      ctx.fillText(label, labelX, yPx);
    }
  
    // --- rysowanie krzywej (łamana) w plotArea ---
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1;
  
    let started = false;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = data.x_tab[i];
      const y = data.y_tab[i];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
  
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

  destroy() {
    this.ro?.disconnect();
    this.ro = null;
  }
}
