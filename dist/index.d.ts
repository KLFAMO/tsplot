type CanvasPlotOptions = {
    background?: string;
};
declare class CanvasPlot {
    private canvas;
    private ctx;
    private ro;
    private options;
    private data;
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
