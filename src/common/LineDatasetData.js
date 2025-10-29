import * as d3 from "d3";

export class LineDatasetData {

    constructor(label, data, fill, pointRadius, tension, colorFunction, colorKey = null) {
        this.label = label;
        this.data = data;
        this.fill = fill;
        this.pointRadius = pointRadius;
        this.tension = tension;
        this.colorFunction = colorFunction;
        this.colorKey = colorKey;
    }

    getDataSet() {
        const keyForColor = this.colorKey ?? this.label;
        return {
            label: this.label,
            data: this.data.map(value => JSON.parse(value)),
            fill: this.fill,
            borderColor: this.colorFunction(keyForColor),
            backgroundColor: this.colorFunction(keyForColor),
            tension: this.tension,
            pointRadius: this.pointRadius
        };
    }
}
