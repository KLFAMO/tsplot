type CanvasPlotOptions = {
    background?: string;
};
declare class CanvasPlot {
    private canvas;
    private ctx;
    private ro;
    private options;
    private data;
    private f;
    private t;
    private lastMouseEvent;
    constructor(canvas: HTMLCanvasElement, options?: CanvasPlotOptions);
    setOptions(partial: CanvasPlotOptions): void;
    setData(raw: unknown): void;
    /**
     * Fetch JSON from `url` and set it as the plot data.
     * Convenience helper to keep calling code minimal.
     */
    loadFromUrl(url: string): Promise<void>;
    /**
     * Create a CanvasPlot from a canvas element or element id.
     * Accepts either an `HTMLCanvasElement` or a string id.
     */
    static create(canvasOrId: string | HTMLCanvasElement, options?: CanvasPlotOptions): CanvasPlot;
    /**
     * Attach a button to trigger loading data. `urlProvider` should return the URL to fetch.
     * Optional `statusEl` will receive simple status messages.
     */
    /**
     * Enable cursor tracking: when 'v' key is pressed, log plot coordinates at current cursor position.
     * This helps inspect data values at specific points. Logs to console.debug.
     */
    enableCursorTracking(enabled?: boolean): void;
    private onKeyDown;
    /**
     * Convert screen pixel coordinates (from MouseEvent) to plot data units (x, y).
     * Returns null if no data is loaded or click is outside plot area.
     */
    private getPlotCoordinatesFromEvent;
    /**
     * Remove unused method onCanvasMouseMove - now using keydown handler instead
     */
    private weightedMedian;
    private weightedQuantile;
    private yToT;
    private tToY;
    render(): void;
    destroy(): void;
}

type TimandaTsplotSchema = "timanda-tsplot";
type TimandaTsplotEnvelopeBase = {
    schema: TimandaTsplotSchema;
    version: number;
    type: string;
};
type TimandaMtsSegmentV1 = {
    mjd: number[];
    val: number[];
};
type TimandaMtsV1 = TimandaTsplotEnvelopeBase & {
    type: "MTS";
    version: 1;
    segments: TimandaMtsSegmentV1[];
};
type TimandaTsplotJsonV1 = TimandaMtsV1;

/**
 * Parse + validate "timanda-tsplot" JSON envelope.
 * Throws a descriptive Error when validation fails.
 */
declare function parseTimandaTsplotJson(raw: unknown): TimandaTsplotJsonV1;

export { CanvasPlot, type TimandaMtsSegmentV1, type TimandaMtsV1, type TimandaTsplotJsonV1, parseTimandaTsplotJson };
