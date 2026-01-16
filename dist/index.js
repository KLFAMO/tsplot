// src/core/resize.ts
function resizeCanvasToDisplaySize(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const displayWidth = Math.max(1, Math.round(rect.width));
  const displayHeight = Math.max(1, Math.round(rect.height));
  const neededWidth = Math.round(displayWidth * dpr);
  const neededHeight = Math.round(displayHeight * dpr);
  const changed = canvas.width !== neededWidth || canvas.height !== neededHeight;
  if (changed) {
    canvas.width = neededWidth;
    canvas.height = neededHeight;
  }
  return { changed, dpr, displayWidth, displayHeight };
}

// src/data/parse.ts
function isObject(v) {
  return typeof v === "object" && v !== null;
}
function isNumberArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x));
}
function parseTimandaTsplotJson(raw) {
  if (!isObject(raw)) {
    throw new Error("tsplot: invalid data (expected object).");
  }
  const schema = raw.schema;
  const version = raw.version;
  const type = raw.type;
  if (schema !== "timanda-tsplot") {
    throw new Error(`tsplot: unsupported schema: ${String(schema)}.`);
  }
  if (version !== 1) {
    throw new Error(`tsplot: unsupported version: ${String(version)}.`);
  }
  if (type !== "MTS") {
    throw new Error(`tsplot: unsupported type: ${String(type)}.`);
  }
  const segments = raw.segments;
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error("tsplot: MTS has no segments.");
  }
  const s0 = segments[0];
  if (!isObject(s0)) {
    throw new Error("tsplot: invalid segment[0] (expected object).");
  }
  if (!isNumberArray(s0.mjd) || !isNumberArray(s0.val)) {
    throw new Error("tsplot: invalid segment[0] (expected mjd:number[] and val:number[]).");
  }
  return raw;
}

// src/core/CanvasPlot.ts
var CanvasPlot = class {
  canvas;
  ctx;
  ro = null;
  options;
  // [NEW] Trzymamy pełne dane z timandy w bibliotece, nie w window ani w aplikacji
  data = null;
  constructor(canvas, options = {}) {
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
  setOptions(partial) {
    this.options = { ...this.options, ...partial };
    this.render();
  }
  // [NEW] Publiczne API do podania pełnego JSON-a timandy
  setData(raw) {
    const parsed = parseTimandaTsplotJson(raw);
    this.data = parsed;
    this.render();
  }
  render() {
    const { displayWidth, displayHeight, dpr } = resizeCanvasToDisplaySize(this.canvas);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, displayWidth, displayHeight);
    this.ctx.fillStyle = this.options.background;
    this.ctx.fillRect(0, 0, displayWidth, displayHeight);
    if (!this.data || !this.data.segments?.length) return;
    const seg0 = this.data.segments[0];
    const x_tab = seg0.mjd;
    const y_tab = seg0.val;
    if (!x_tab?.length || !y_tab?.length) return;
    const n = Math.min(x_tab.length, y_tab.length);
    if (n < 2) return;
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = x_tab[i];
      const y = y_tab[i];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
    if (!Number.isFinite(xmin) || !Number.isFinite(xmax) || !Number.isFinite(ymin) || !Number.isFinite(ymax)) return;
    const dx = xmax - xmin || 1;
    const dy = ymax - ymin || 1;
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
    const xToPx = (x) => plotArea.x + (x - xmin) / dx * plotArea.w;
    const yToPx = (y) => plotArea.y + (1 - (y - ymin) / dy) * plotArea.h;
    const ctx = this.ctx;
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.strokeRect(plotArea.x, plotArea.y, plotArea.w, plotArea.h);
    let ticks = 5;
    const tickLen = 6;
    const fmt = (v, span) => {
      const absSpan = Math.abs(span);
      if (absSpan >= 1e6) return v.toExponential(3);
      if (absSpan >= 1e3) return v.toFixed(2);
      if (absSpan >= 1) return v.toFixed(4);
      return v.toExponential(3);
    };
    ctx.fillStyle = "#222";
    ctx.font = "12px sans-serif";
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
      const label = fmt(xVal, dx);
      const labelY = bottomArea.y + 6;
      ctx.fillText(label, xPx, labelY);
    }
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
      const label = fmt(yVal, dy);
      const labelX = leftArea.x + leftArea.w - 6;
      ctx.fillText(label, labelX, yPx);
    }
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1;
    let started = false;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = x_tab[i];
      const y = y_tab[i];
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
};
export {
  CanvasPlot,
  parseTimandaTsplotJson
};
//# sourceMappingURL=index.js.map