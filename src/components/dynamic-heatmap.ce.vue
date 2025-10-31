<script setup>
import { nextTick, ref, watch, watchEffect } from "vue";
import { CommunicationService } from "../services/CommunicationService.js";
import VueApexCharts from "vue3-apexcharts"
import { binningColorConfig } from "@/common/colorsConfig.js";
import { luxonDateTimeToString } from "../common/dateUtils.js"

const communicationService = new CommunicationService();
const heatmapSeries = ref([]);
const chartOptions = ref({ emitsOptions: false })
const images = ref({})
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
  if (!(Object.keys(images.value).length == 0)) {
    return
  }

  timestamp = Number(timestamp)
  if (!images.value.has(timestamp)) {
    console.log("Image " + timestamp + " is missing")
    return
  }

  const image = images.value.get(timestamp)

  let xValues = []
  const series = Array.from(image.reduce((accumulator, currentValue) => {
    if (!accumulator.has(currentValue.y))
      accumulator.set(currentValue.y, []);
    accumulator.get(currentValue.y).push({
      x: currentValue.x,
      value: currentValue.value.toFixed(2)
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

  heatmapSeries.value = series
  if (!container.value) {
    await nextTick()
  }
  const containerWidth = container.value.offsetWidth

  let cellSize
  if (heatmapSeries.value[0].data.length > heatmapSeries.value.length) {
    cellSize = containerWidth / heatmapSeries.value[0].data.length
  } else {
    cellSize = containerWidth / heatmapSeries.value.length * 0.7
  }

  cellSize = Math.min(cellSize, 40)

  const verticalOffset = 60
  const horizontalOffset = 10
  const chartHeight = (cellSize * heatmapSeries.value.length + verticalOffset)
  const chartWidth = (cellSize * heatmapSeries.value[0].data.length + horizontalOffset)

  chartOptions.value = {
    chart: {
      offsetX: (containerWidth - chartWidth) / 2,
      type: 'heatmap',
      height: (chartHeight + "px"),
      width: (chartWidth + "px"),
      toolbar: {
        show: false
      },
      zoom: {
        enabled: false,
      },
      animations: {
        enabled: false,
        animateGradually: {
          enabled: false,
        },
        dynamicAnimation: {
          enabled: false,
        }
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
          }))
          ]
        }
      },
    },
    dataLabels: {
      enabled: false,
    },
    legend: {
      show: false,
    },
    stroke: {
      width: 0
    },
    title: {
      text: 'Matrice dell\'umidità a ' + luxonDateTimeToString(timestamp),
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
      enabled: false
    }
  }
}

async function mountChart() {
  const configParsed = JSON.parse(props.config);
  const chartDataResponse = await communicationService.getChartData(configParsed.environment, configParsed.paths, configParsed.params, endpoint, 'images')
  const binningId = chartDataResponse.binningId

  const data = chartDataResponse.data;
  if (chartDataResponse) {
    images.value = new Map(data.map(obj => [obj.timestamp, obj.image]))
    binningInfo.value = await communicationService.getBinningInfo(configParsed.environment, binningId, 'bins')
    showChart.value = images.value.size > 0
    await nextTick()
    if (showChart.value) {
      const timestamps = Array.from(images.value.keys()).sort()
      await drawImage(timestamps[timestamps.length - 1])
    }
  } else {
    showChart.value = false
  }
}
</script>

<template>
  <div v-if="showChart" ref="container">
    <VueApexCharts type="heatmap" :options="chartOptions" :series="heatmapSeries"></VueApexCharts>
  </div>
</template>

<style>
@import '../assets/main.css';
</style>