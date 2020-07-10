import {
    _,
    CaptionOptions,
    ChartOptions,
    ChartOptionsChanged,
    ChartType,
    DropShadowOptions,
    Events,
    EventService,
    PaddingOptions,
    ProcessChartOptionsParams,
    SeriesOptions,
    GridApi,
    ColumnApi, FontOptions, LegendPosition,
} from "@ag-grid-community/core";
import {
    AreaSeries,
    Caption,
    CategoryAxis,
    BarSeries,
    DropShadow,
    Padding,
    PieSeries, AgChartOptions, IChartTheme
} from "ag-charts-community";
import { ChartPalette, ChartPaletteName, palettes } from "./palettes";

export interface ChartProxyParams {
    chartId: string;
    chartType: ChartType;
    width?: number;
    height?: number;
    parentElement: HTMLElement;
    grouping: boolean;
    document: Document;
    processChartOptions: (params: ProcessChartOptionsParams) => ChartOptions<SeriesOptions>;
    getChartPaletteName: () => ChartPaletteName;
    allowPaletteOverride: boolean;
    isDarkTheme: () => boolean;
    eventService: EventService;
    gridApi: GridApi;
    columnApi: ColumnApi;
}

export interface FieldDefinition {
    colId: string;
    displayName: string;
}

export interface UpdateChartParams {
    data: any[];
    grouping: boolean;
    category: {
        id: string;
        name: string;
    };
    fields: FieldDefinition[];
}

export abstract class ChartProxy {

    protected readonly chartId: string;
    protected readonly chartType: ChartType;
    protected readonly eventService: EventService;
    private readonly gridApi: GridApi;
    private readonly columnApi: ColumnApi;

    protected chart: any;
    protected customPalette: ChartPalette;
    protected chartOptions: AgChartOptions;
    protected userTheme: IChartTheme;

    protected constructor(protected readonly chartProxyParams: ChartProxyParams) {
        this.chartId = chartProxyParams.chartId;
        this.chartType = chartProxyParams.chartType;
        this.eventService = chartProxyParams.eventService;
        this.gridApi = chartProxyParams.gridApi;
        this.columnApi = chartProxyParams.columnApi;
    }

    protected abstract createChart(options?: AgChartOptions): any;

    public recreateChart(options?: AgChartOptions): void {
        if (this.chart) {
            this.destroyChart();
        }

        this.chart = this.createChart(options);
    }

    public abstract update(params: UpdateChartParams): void;

    public getChart(): any {
        return this.chart;
    }

    public downloadChart(): void {
        const { chart } = this;
        const fileName = chart.title ? chart.title.text : 'chart';
        chart.scene.download(fileName);
    }

    public getChartImageDataURL(type?: string) {
        return this.chart.scene.getDataURL(type);
    }

    private isDarkTheme = () => this.chartProxyParams.isDarkTheme();
    // protected getFontColor = (): string => this.isDarkTheme() ? 'rgb(221, 221, 221)' : 'rgb(87, 87, 87)';
    // protected getAxisGridColor = (): string => this.isDarkTheme() ? 'rgb(100, 100, 100)' : 'rgb(219, 219, 219)';
    // protected getBackgroundColor = (): string => this.isDarkTheme() ? '#2d3436' : 'white';

    protected abstract getDefaultOptions(): AgChartOptions;

    protected initChartOptions(): void {
        const { processChartOptions } = this.chartProxyParams;

        // allow users to override options before they are applied
        if (processChartOptions) {
            // const params: ProcessChartOptionsParams = { type: this.chartType, options: this.getDefaultOptions() };
            // const overriddenOptions = processChartOptions(params) as AgChartOptions;
            //
            // // ensure we have everything we need, in case the processing removed necessary options
            // const safeOptions = this.getDefaultOptions();
            // _.mergeDeep(safeOptions, overriddenOptions, false);
            //
            // // this.overridePalette(safeOptions);
            // this.chartOptions = safeOptions;
        } else {
            this.chartOptions = this.getDefaultOptions();
        }
    }

    // private overridePalette(chartOptions: AgChartOptions): void {
    //     if (!this.chartProxyParams.allowPaletteOverride) {
    //         return;
    //     }
    //
    //     const { fills: defaultFills, strokes: defaultStrokes } = this.getPredefinedPalette();
    //     const { seriesDefaults } = chartOptions;
    //     const fills = seriesDefaults.fills || seriesDefaults.fill.colors; // the latter is deprecated
    //     const strokes = seriesDefaults.strokes || seriesDefaults.stroke.colors; // the latter is deprecated
    //     const fillsOverridden = fills && fills.length > 0 && fills !== defaultFills;
    //     const strokesOverridden = strokes && strokes.length > 0 && strokes !== defaultStrokes;
    //
    //     if (fillsOverridden || strokesOverridden) {
    //         this.customPalette = {
    //             fills: fillsOverridden ? fills : defaultFills,
    //             strokes: strokesOverridden ? strokes : defaultStrokes
    //         };
    //     }
    // }

    public getChartOptions(): AgChartOptions {
        return this.chartOptions;
    }

    // public getCustomPalette(): ChartPalette | undefined {
    //     return this.customPalette;
    // }

    public getChartOption<T = string>(expression: string): T {
        return _.get(this.chartOptions, expression, undefined) as T;
    }

    public setChartOption(expression: string, value: any): void {
        if (_.get(this.chartOptions, expression, undefined) === value) {
            // option is already set to the specified value
            return;
        }

        _.set(this.chartOptions, expression, value);
        _.set(this.chart, expression, value);

        this.raiseChartOptionsChangedEvent();
    }

    public getSeriesOption<T = string>(expression: string): T {
        return _.get(this.chartOptions.series[0], expression, undefined) as T;
        // return _.get(this.chartOptions.seriesDefaults, expression, undefined) as T;
    }

    public setSeriesOption(expression: string, value: any): void {
        // if (_.get(this.chartOptions.seriesDefaults, expression, undefined) === value) {
        //     // option is already set to the specified value
        //     return;
        // }

        if (_.get(this.chartOptions.series[0], expression, undefined) === value) {
            // option is already set to the specified value
            return;
        }

        _.set(this.chartOptions.series[0], expression, value);
        // _.set(this.chartOptions.seriesDefaults, expression, value);

        const mappings: { [key: string]: string; } = {
            'stroke.width': 'strokeWidth',
            'stroke.opacity': 'strokeOpacity',
            'fill.opacity': 'fillOpacity',
            'tooltip.enabled': 'tooltipEnabled',
            'callout.colors': 'calloutColors'
        };

        // const series = this.chart.series;
        // series.forEach(s => _.set(s, mappings[expression] || expression, value));

        this.chartOptions.series.forEach((s: any) => _.set(s, mappings[expression] || expression, value));

        this.raiseChartOptionsChangedEvent();
    }

    public setTitleOption(property: keyof CaptionOptions, value: any) {
        if (_.get(this.chartOptions.title, property, undefined) === value) {
            // option is already set to the specified value
            return;
        }

        (this.chartOptions.title as any)[property] = value;

        if (!this.chart.title) {
            this.chart.title = {} as Caption;
        }

        (this.chart.title as any)[property] = value;

        if (property === 'text') {
            this.setTitleOption('enabled', _.exists(value));
        }

        this.raiseChartOptionsChangedEvent();
    }

    public getTitleOption(property: keyof CaptionOptions) {
        return (this.chartOptions.title as any)[property];
    }

    public getChartPaddingOption = (property: string): string => (this.chart.padding as any)[property] || '';

    public setChartPaddingOption(property: keyof PaddingOptions, value: number): void {
        let { padding } = this.chartOptions;

        if (_.get(padding, property, undefined) === value) {
            // option is already set to the specified value
            return;
        }

        if (!padding) {
            padding = this.chartOptions.padding = { top: 0, right: 0, bottom: 0, left: 0 };
            this.chart.padding = new Padding(0);
        }

        padding[property] = value;

        this.chart.padding[property] = value;

        this.raiseChartOptionsChangedEvent();
    }

    public getShadowEnabled = (): boolean => !!this.getShadowProperty('enabled');

    protected getFirstSeriesOptions(): any {
        const { series } = this.chartOptions;
        return series && series[0];
    }

    public getShadowProperty(property: keyof DropShadowOptions): any {
        // const { seriesDefaults } = this.chartOptions;
        // return seriesDefaults.shadow ? seriesDefaults.shadow[property] : '';

        const { seriesOptions } = this.getFirstSeriesOptions();
        return seriesOptions.shadow ? seriesOptions.shadow[property] : '';
    }

    public setShadowProperty(property: keyof DropShadowOptions, value: any): void {
        // const { seriesDefaults } = this.chartOptions;
        const { seriesOptions } = this.getFirstSeriesOptions();

        if (_.get(seriesDefaults.shadow, property, undefined) === value) {
            // option is already set to the specified value
            return;
        }

        if (!seriesDefaults.shadow) {
            seriesDefaults.shadow = {
                enabled: false,
                blur: 0,
                xOffset: 0,
                yOffset: 0,
                color: 'rgba(0,0,0,0.5)'
            };
        }

        seriesDefaults.shadow[property] = value;

        const series = this.getChart().series as (BarSeries | AreaSeries | PieSeries)[];

        series.forEach(s => {
            if (!s.shadow) {
                const shadow = new DropShadow();
                shadow.enabled = false;
                shadow.blur = 0;
                shadow.xOffset = 0;
                shadow.yOffset = 0;
                shadow.color = 'rgba(0,0,0,0.5)';
                s.shadow = shadow;
            }

            (s.shadow as any)[property] = value;
        });

        this.raiseChartOptionsChangedEvent();
    }

    public raiseChartOptionsChangedEvent(): void {
        const event: ChartOptionsChanged = Object.freeze({
            type: Events.EVENT_CHART_OPTIONS_CHANGED,
            chartId: this.chartId,
            chartType: this.chartType,
            chartPalette: this.chartProxyParams.getChartPaletteName(),
            chartOptions: this.chartOptions,
            api: this.gridApi,
            columnApi: this.columnApi,
        });

        this.eventService.dispatchEvent(event);
    }

    protected getPredefinedPalette(): ChartPalette {
        return palettes.get(this.chartProxyParams.getChartPaletteName());
    }

    protected getPalette(): ChartPalette {
        return this.customPalette || this.getPredefinedPalette();
    }

    protected getDefaultChartOptions(): ChartOptions<SeriesOptions> {
        const { fills, strokes } = this.getPredefinedPalette();
        const fontOptions = this.getDefaultFontOptions();

        return {
            background: {
                fill: this.getBackgroundColor(),
                visible: true,
            },
            padding: {
                top: 20,
                right: 20,
                bottom: 20,
                left: 20,
            },
            title: {
                ...fontOptions,
                enabled: false,
                fontWeight: 'bold',
                fontSize: 16,
            },
            subtitle: {
                ...fontOptions,
                enabled: false,
            },
            legend: {
                enabled: true,
                position: LegendPosition.Right,
                spacing: 20,
                item: {
                    label: {
                        ...fontOptions,
                    },
                    marker: {
                        shape: 'square',
                        size: 15,
                        padding: 8,
                        strokeWidth: 1,
                    },
                    paddingX: 16,
                    paddingY: 8,
                },
            },
            navigator: {
                enabled: false,
                height: 30,
                min: 0,
                max: 1,
                mask: {
                    fill: '#999999',
                    stroke: '#999999',
                    strokeWidth: 1,
                    fillOpacity: 0.2
                },
                minHandle: {
                    fill: '#f2f2f2',
                    stroke: '#999999',
                    strokeWidth: 1,
                    width: 8,
                    height: 16,
                    gripLineGap: 2,
                    gripLineLength: 8
                },
                maxHandle: {
                    fill: '#f2f2f2',
                    stroke: '#999999',
                    strokeWidth: 1,
                    width: 8,
                    height: 16,
                    gripLineGap: 2,
                    gripLineLength: 8
                }
            },
            seriesDefaults: {
                fill: {
                    colors: fills,
                    opacity: 1,
                },
                stroke: {
                    colors: strokes,
                    opacity: 1,
                    width: 1,
                },
                highlightStyle: {
                    fill: 'yellow',
                },
                listeners: {}
            },
            listeners: {}
        };
    }

    protected getDefaultFontOptions(): FontOptions {
        return {
            fontStyle: 'normal',
            fontWeight: 'normal',
            fontSize: 12,
            fontFamily: 'Verdana, sans-serif',
            color: this.getFontColor()
        };
    }

    protected getDefaultDropShadowOptions(): DropShadowOptions {
        return {
            enabled: false,
            blur: 5,
            xOffset: 3,
            yOffset: 3,
            color: 'rgba(0, 0, 0, 0.5)',
        };
    }

    protected transformData(data: any[], categoryKey: string): any[] {
        if (this.chart.axes.filter(a => a instanceof CategoryAxis).length < 1) {
            return data;
        }

        // replace the values for the selected category with a complex object to allow for duplicated categories
        return data.map((d, index) => {
            const value = d[categoryKey];
            const valueString = value && value.toString ? value.toString() : '';
            const datum = { ...d };

            datum[categoryKey] = { id: index, value, toString: () => valueString };

            return datum;
        });
    }

    public destroy(): void {
        this.destroyChart();
    }

    protected destroyChart(): void {
        if (this.chart) {
            this.chart.destroy();
            this.chart = undefined;
        }
    }
}
