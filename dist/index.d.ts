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
