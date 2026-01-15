type CanvasPlotOptions = {
    background?: string;
};
declare class CanvasPlot {
    private canvas;
    private ctx;
    private ro;
    private options;
    constructor(canvas: HTMLCanvasElement, options?: CanvasPlotOptions);
    setOptions(partial: CanvasPlotOptions): void;
    render(): void;
    destroy(): void;
}

export { CanvasPlot };
