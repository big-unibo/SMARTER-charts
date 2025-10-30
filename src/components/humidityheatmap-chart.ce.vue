<script setup>
import { ref, watch, watchEffect } from "vue";
import { CommunicationService } from "../services/CommunicationService.js";
import VueApexCharts from "vue3-apexcharts"
import { luxonDateTimeToString } from "../common/dateUtils.js"
import * as d3 from "d3";
import { binningColorConfig } from "@/common/colorsConfig.js";

const communicationService = new CommunicationService();
const heatmapSeries = ref([]);
const chartOptions = ref({ emitsOptions: false })
const images = ref(new Map())
const container = ref(null)
const binningInfo = ref([])

const props = defineProps(['config', 'selectedTimestamp'])
const showChart = ref(false)
const loadingFlag = ref(false)
const endpoint = 'heatmap'

watchEffect(async () => {
  let value = props.config;
  if (value) {
    await mountChart()
  }
});

watch(() => props.selectedTimestamp, async (timestamp) => {
  if (timestamp) {
    await drawImage(timestamp)
  }
})

async function drawImage(timestamp) {
  // if (!(Object.keys(images.value).length == 0)){
  //   return
  // }

  timestamp = Number(timestamp)
  if (!images.value.has(timestamp)) {
    console.log("Image " + timestamp + " is missing")
    return
  }

  //const parsed = JSON.parse(props.config);
  // const dripperPos = await communicationService.getFieldInfo(parsed.environment, parsed.paths, {timestamp: timestamp}, "dripperInfo")
  // if(JSON.stringify(parsed) !== props.config){
  //     return
  // }

  const image = images.value.get(timestamp)
  let xValues = []
  const series = Array.from(image.reduce((accumulator, currentValue) => {
    if (!accumulator.has(currentValue.y))
      accumulator.set(currentValue.y, []);
    accumulator.get(currentValue.y).push({
      x: currentValue.x,
      value: Number(currentValue.value.toFixed(2))
    })
    return accumulator
  }, new Map()), ([key, value]) => {
    if (xValues.length === 0) {
      xValues = value.map(e => e.x)
    }
    return {
      name: key,
      data: value.sort((a, b) => a.x - b.x).map(e => e.value)
    }
  }).sort((a, b) => b.name - a.name)


  console.log(binningInfo.value)
  const maxUpperBound = Math.max(...binningInfo.value.map(bin => Number(bin.upperBound)));
  const EMPTY_VALUE = maxUpperBound + 1;
  const DRIPPER_VALUE = maxUpperBound;

  const dripperSeries = {
    name: "0",
    data: new Array(series[0].data.length).fill(EMPTY_VALUE)
  }

  // dripperSeries.data[xValues.indexOf(dripperPos.x)] = 0
  dripperSeries.data[xValues.indexOf(0)] = DRIPPER_VALUE

  series.push(dripperSeries)

  heatmapSeries.value = series
  if (!container.value) {
    return
  }

  const containerWidth = container.value.offsetWidth

  let cellSize
  if (heatmapSeries.value[0].data.length > heatmapSeries.value.length) {
    cellSize = containerWidth / heatmapSeries.value[0].data.length
  } else {
    cellSize = containerWidth / heatmapSeries.value.length * 0.9
  }

  cellSize = Math.min(cellSize, 32)

  const verticalOffset = 60
  const horizontalOffset = 10
  const chartHeight = (cellSize * Math.max(heatmapSeries.value.length, 7) + verticalOffset)
  const chartWidth = (cellSize * Math.max(heatmapSeries.value[0].data.length, 7) + horizontalOffset)

  chartOptions.value = {
    chart: {
      type: 'heatmap',
      height: (chartHeight + "px"),
      width: (chartWidth + "px"),
      toolbar: {
        offsetX: chartWidth < containerWidth * 0.75 ? containerWidth * 0.1 : 0,
        show: true
      },
      zoom: {
        enabled: false,
      }
    },
    plotOptions: {
      heatmap: {
        enableShades: false,
        radius: 0,
        colorScale: {
          ranges: [...binningInfo.value.map(bin => ({
            from: Number(bin.lowerBound),
            to: Number(bin.upperBound),
            name: bin.humidityBinDescription,
            color: binningColorConfig(bin.humidityBin)
          })),
          {
            from: EMPTY_VALUE,
            to: EMPTY_VALUE,
            name: " ",
            color: "#ffffff"
          }
          ]
        },
      },
    },
    dataLabels: {
      formatter: function (value, { seriesIndex, dataPointIndex, w }) {
        if (value == EMPTY_VALUE) {
          return ""
        }
        if (value == DRIPPER_VALUE) {
          return "G"
        } else {
          return value.toFixed(0)
        }
      },
      enabled: cellSize > 15,
      style: {
        fontSize: (cellSize > 22 ? '10' : '9') + 'px',
      }
    },
    legend: {
      show: verticalOffset / chartHeight < 0.2,
      markers: {
        width: 5,
        height: 16,
        radius: 0
      }
    },
    stroke: {
      width: 0
    },
    title: {
      text: 'Interpolazione bilineare ' + luxonDateTimeToString(timestamp),
      align: 'center',
      offsetY: 10,
    },
    xaxis: {
      type: 'category',
      categories: xValues,
      tooltip: {
        enabled: false,
      },
      tickPlacement: 'on',
      labels: {
        show: true
      }
    },
    yaxis: {
      axisTicks: {
        show: true,
      },
      labels: {
        style: {
          fontSize: '12px'
        }
      }
    },
    tooltip: {
      custom: function ({ series, seriesIndex, dataPointIndex, w }) {
        let value = series[seriesIndex][dataPointIndex]
        if (value == EMPTY_VALUE) {
          value = "-"
        }
        if (value == DRIPPER_VALUE) {
          value = "G"
        }
        return ('<div class="arrow_box m-1">' +
          '<div> <strong>val</strong>: ' + value + '</div>' +
          '<div> <strong>x</strong>: ' + xValues[dataPointIndex] + '</div>' +
          '<div> <strong>y</strong>: ' + heatmapSeries.value[seriesIndex].name + '</div>' +
          '</div>')
      }
    }
  }
}

async function mountChart() {
  const configParsed = JSON.parse(props.config);

  showChart.value = false
  loadingFlag.value = true

  let response = await communicationService.getChartData(configParsed.environment, configParsed.paths, configParsed.params, endpoint, 'images')
  if (JSON.stringify(configParsed) !== props.config) {
    return
  }

  const binningId = response.binningId
  const chartDataResponse = response.data


  binningInfo.value = await communicationService.getBinningInfo(configParsed.environment, binningId, 'bins')
  if (JSON.stringify(configParsed) !== props.config) {
    return
  }

  // const dripperPos = await communicationService.getFieldInfo(parsed.environment, parsed.paths, {timestamp: timestamp}, "dripperInfo")
  console.log(chartDataResponse)

  if (chartDataResponse) {
    images.value = new Map(chartDataResponse.map(obj => [obj.timestamp, obj.image]))
    showChart.value = images.value.size > 0
    if (showChart.value) {
      const timestamps = Array.from(images.value.keys()).sort()
      if (props.selectedTimestamp) {
        await drawImage(props.selectedTimestamp)
      } else {
        await drawImage(timestamps[timestamps.length - 1])
      }
    }
  } else {
    showChart.value = false
  }
  loadingFlag.value = false
}
</script>

<template>
  <div v-if="showChart" ref="container">
    <VueApexCharts type="heatmap" :options="chartOptions" :series="heatmapSeries"></VueApexCharts>
  </div>
  <div v-else-if="loadingFlag" class="d-flex justify-content-center align-items-center">
    <div class="spinner-border" role="status">
      <span class="sr-only"></span>
    </div>
  </div>
</template>

<style>
@import '../assets/main.css';

.vue-apexcharts {
  display: flex;
  justify-content: center;
  align-items: center;
}

.apexcharts-legend-marker {
  width: 5px !important;
  height: 16px !important;
}
</style>