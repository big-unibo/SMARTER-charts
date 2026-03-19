# SMARTER-charts

In this package are distributed the charts components developed for the precision irrigation system **SMARTER** by the *Business Intelligence Group* of University of Bologna.


## Installation
```bash
npm install smarter-charts
```
## Usage

All the components are exposed as Custum Elements that are defined by the funcion `registerChartComponents()` and then they can be used directly as HTML tags. 

```js
import {registerChartComponents} from 'smarter-charts'

registerChartComponents()

```

## Global `config` Prop

All components accept a `config` object to handle backend connection, resource paths, and time filtering.

```js
config: {
  environment: {
    host: string,  // Backend API base URL
    token: string  // Authorization token for API calls
  },
  paths: {
    sectorId: integer,
    thesisId: integer
  },  // One or more resource identifiers (e.g., farm IDs, sensors, plots)
  params: {
    timeFilterFrom?: string,  // ISO date string or timestamp (start of time range)
    timeFilterTo?: string     // ISO date string or timestamp (end of time range)
    signalTypes?: string[], // String IDs of the possible signal type retrieved by SMARTER API (e.g. ['AIR_TEMP'])
		aggregationType?: string // Type of aggregation to perform on data. Accepted type: (SUM, AVG, MIN, MAX, MED)
  }
}
```

## Available Components

| Component Tag| Description| Props/Events|
|----------------------------------------------|-------------------------------------------------------------------------|---|
| `<optimal-distance-chart-smarter>`           | Line chart showing humidity level in relation to optimal state ||
| `<airtemperature-chart-smarter>`             | Line chart for air temperature trends |
| `<meancountor-chart-smarter>`                | Heatmap of monitored soil portion for **mean** of matric potential in a given period|
| `<stdcountor-chart-smarter>`                 | Heatmap of monitored soil portion for **standard deviation** of matric potential in a given period |
| `<dripperandpluv-chart-smarter>`             | Line chart showing irrigation and rainfall |
| `<signals-linechart-chart-smarter>`          | Line chart for signals of requested type | `:hideOnMissingSignal` flage that indicates if hide chart when no signals retrieved
| `<humiditymap-smarter>`                      | Heatmap of monitored soil portion showing the matric potential | `:selectedTimestamp` timestamp of image to show
| `<humiditymultiline-chart-smarter>`          | Area chart of humidity levels over times | `@selectTimestamp` events emitted containing the timestamp clicked
| `<heatmap-animation-smarter>`                | Animation of humidity heatmap over time |
| `<optimal-humidity-heatmap-smarter>`         | Heatmaps of optimal soil state to obtain with cell weights | `:selectedTimestamp` timestamp of image to show <br>`:showDistance` flag that indicates if show the distance matrix
| `<calendar-smarter>`                         | Calendar with irrigation events |
| `<water-aggregate-chart-smarter>`            | Bar chart to summarize daily irrigation and rainfalls|


