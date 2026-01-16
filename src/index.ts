// tsplot/src/index.ts

export { CanvasPlot } from "./core/CanvasPlot";

// [NEW - opcjonalnie, ale praktycznie]
export { parseTimandaTsplotJson } from "./data/parse";
export type { TimandaMtsV1, TimandaMtsSegmentV1, TimandaTsplotJsonV1 } from "./data/timanda_schema";
