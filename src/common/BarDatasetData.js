
export class BarDatasetData {

    constructor(label, data, yAxisID, colorFunction, colorKey) {
        this.label = label;
        this.data = data;
        this.yAxisID = yAxisID;
        this.colorFunction = colorFunction;
        this.colorKey = colorKey;
    }

    getDataSet() {
        const keyForColor = this.colorKey ?? this.label;
        return {
            label: this.label,
            data: this.data.map(value => JSON.parse(value)),
            borderColor: this.colorFunction(keyForColor),
            backgroundColor: this.colorFunction(keyForColor),
            yAxisID: this.yAxisID
        }
    }

}