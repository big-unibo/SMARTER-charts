<script setup>
import { nextTick, ref, watch, watchEffect } from "vue";
import { CommunicationService } from "../services/CommunicationService.js";
import VueApexCharts from "vue3-apexcharts"

const communicationService = new CommunicationService();
const heatmapSeries = ref([]);
const chartOptions = ref({ emitsOptions: false })
const image = ref(null)
const container = ref(null)
const rDistance = ref(null)
const chartWidthValue = ref('auto');
const chartHeightValue = ref('auto');
const maxDeviation = ref(null)

const props = defineProps(['config', 'selectedTimestamp'])
const showChart = ref(false)
const loadingFlag = ref(false)
const endpoint = 'distanceProfileToOptimal'

const NEGATIVE_STEP_COLORS = [
  '#fff1e6', '#ffd1d1', '#ffb0b0', '#ff8f8f', '#ff6e6e',
  '#ff4d4d', '#ff2c2c', '#ff0b0b', '#cc0000'
]
const POSITIVE_STEP_COLORS = [
  '#e6f3f0', '#cde6f6', '#b4d9fc', '#51d1fd', '#46b7e3',
  '#3b9cc9', '#3081af', '#256795', '#1b4c7c'
]
const NEGATIVE_STEP_NAMES = [
  'Near Neutral', 'Slightly Near Average', 'Near Average', 'Low Average',
  'Minor Below Average', 'Moderate Below Average', 'Slightly Below Average',
  'Below Average', 'Low'
]
const POSITIVE_STEP_NAMES = [
  'Near Neutral', 'Slightly Near Average', 'Near Average', 'Low Average',
  'Minor Above Average', 'Moderate Above Average', 'Slightly Above Average',
  'Above Average', 'High'
]
const OUTLIER_NEGATIVE = { color: '#8c0000', name: 'Very Low' }
const OUTLIER_POSITIVE = { color: '#053061', name: 'Very High' }
const NEUTRAL = { color: '#ffffff', name: 'Neutral' }

const STEPS_PER_SIDE = NEGATIVE_STEP_COLORS.length

const OUTLIER_BOUND_MULTIPLIER = 10
const DAVIATION_RANGE_PERCENTAGE = 0.6;


const REFERENCE_MAX_NORMAL_FALLBACK = 24

const buildColorScaleRanges = (maxDeviation) => {
  const deviation = maxDeviation && maxDeviation > 0 ? maxDeviation : REFERENCE_MAX_NORMAL_FALLBACK

  const step = deviation / (STEPS_PER_SIDE + 0.5)
  const neutralHalfWidth = step / 2
  const outlierBound = deviation * OUTLIER_BOUND_MULTIPLIER

  const negativeRanges = NEGATIVE_STEP_COLORS.map((color, i) => {
    const to = -(neutralHalfWidth + i * step)
    const from = -(neutralHalfWidth + (i + 1) * step)
    return { from, to, color, name: NEGATIVE_STEP_NAMES[i] }
  }).reverse() // dal più esterno al più interno

  const positiveRanges = POSITIVE_STEP_COLORS.map((color, i) => {
    const from = neutralHalfWidth + i * step
    const to = neutralHalfWidth + (i + 1) * step
    return { from, to, color, name: POSITIVE_STEP_NAMES[i] }
  })

  return [
    { from: -outlierBound, to: negativeRanges[0].from, ...OUTLIER_NEGATIVE },
    ...negativeRanges,
    { from: -neutralHalfWidth, to: neutralHalfWidth, ...NEUTRAL },
    ...positiveRanges,
    { from: positiveRanges[positiveRanges.length - 1].to, to: outlierBound, ...OUTLIER_POSITIVE },
  ]
}

watchEffect(async () => {
  let value = props.config;
  if (value) {
    await mountChart()
  }
});

const buildHeatmapSeries = (valueKey) => {
  let x = []
  const series = Array.from(image.value.reduce((accumulator, currentValue) => {
    if (!accumulator.has(currentValue.y))
      accumulator.set(currentValue.y, []);
    accumulator.get(currentValue.y).push({
      x: currentValue.x,
      value: currentValue[valueKey].toFixed(2)
    })
    return accumulator
  }, new Map()), ([key, value]) => {
    if (x.length === 0) {
      x = value.map(e => e.x).sort((a, b) => parseInt(a) - parseInt(b))
    }
    return {
      name: key,
      data: value.sort((a, b) => a.x - b.x).map(e => e.value)
    }
  }).sort((a, b) => a.name - b.name)

  return [x, series]
}

async function drawImage() {
  if (!image.value) {
    return
  }


  const [xValues, series] = buildHeatmapSeries("value")

  heatmapSeries.value = series
  if (!container.value) {
    await nextTick()
  }

  const containerWidth = container.value.offsetWidth

  let cellSize
  if (heatmapSeries.value[0].data.length > heatmapSeries.value.length) {
    cellSize = containerWidth / heatmapSeries.value[0].data.length
  } else {
    cellSize = containerWidth / heatmapSeries.value.length * 0.9
  }

  cellSize = Math.min(cellSize, 32)

  const verticalOffset = 25
  const horizontalOffset = 10
  const chartHeight = (cellSize * Math.max(heatmapSeries.value.length, 7) + verticalOffset)
  const chartWidth = (cellSize * Math.max(heatmapSeries.value[0].data.length, 7) + horizontalOffset)

  chartHeightValue.value = chartHeight + "px"
  chartWidthValue.value = chartWidth + "px"

  chartOptions.value = {
    chart: {
      offsetX: (containerWidth - chartWidth) / 2,
      type: 'heatmap',
      height: (chartHeight + "px"),
      width: (chartWidth + "px"),
      toolbar: {
        offsetX: chartWidth < containerWidth * 0.75 ? containerWidth * 0.3 : 0,
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
          ranges: buildColorScaleRanges(maxDeviation.value),
        }
      },
    },
    legend: {
      show: false,
    },
    dataLabels: {
      formatter: function (value, { seriesIndex, dataPointIndex, w }) {
        if (value == 0) {
          return ""
        } else {
          return value
        }
      },
      enabled: cellSize > 20,
      style: {
        fontSize: '10px',
        colors: ["#888888"]
      },

    },
    stroke: {
      width: 0
    },
    title: {
      text: 'Distanze dai valori ottimi',
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
        if (value !== 0) {
          return ('<div class="arrow_box m-1">' +
            '<div> <strong>val</strong>: ' + value + '</div>' +
            '<div> <strong>x</strong>: ' + xValues[dataPointIndex] + '</div>' +
            '<div> <strong>y</strong>: ' + heatmapSeries.value[seriesIndex].name + '</div>' +
            '</div>')
        } else
          return ""

      }
    }
  }
}

async function mountChart() {
  const currentTimestamp = props.selectedTimestamp;
  const currentConfigStr = props.config;
  const configParsed = JSON.parse(props.config)

  showChart.value = false;
  loadingFlag.value = true;

  try {
    const chartDataResponse = await communicationService.getChartData(
      configParsed.environment,
      configParsed.paths,
      { timestamp: currentTimestamp },
      endpoint
    );

    if (props.selectedTimestamp !== currentTimestamp || props.config !== currentConfigStr) {
      return;
    }

    const data = chartDataResponse?.image;
    
    if (!data || data.length === 0) {
      showChart.value = false;
      return;
    }

    image.value = data;
    showChart.value = true;

    const { optimalWetBound, optimalDryBound } = chartDataResponse
    if (optimalWetBound != null && optimalDryBound != null) {
      maxDeviation.value = Math.abs(optimalDryBound - optimalWetBound) * DAVIATION_RANGE_PERCENTAGE
    } else {
      maxDeviation.value = null
    }

    const totals = data.reduce((acc, item) => {
      acc.valSum += item.value;      
      acc.weightSum += item.weight;
      return acc;
    }, { valSum: 0, weightSum: 0 });

    if (totals.weightSum !== 0) {
      rDistance.value = (totals.valSum / totals.weightSum).toFixed(2);
    } else {
      rDistance.value = "0.00";
    }

    await drawImage();

  } catch (error) {
    console.error("Errore recupero dati grafico:", error);
    showChart.value = false;
  } finally {
    if (props.selectedTimestamp === currentTimestamp && props.config === currentConfigStr) {
      loadingFlag.value = false;
    }
  }
}
</script>

<template>
  <div class="text-center px-2 p-1 m-1 mx-auto">
    <div>Distanza dall'ottimo (r): {{ rDistance }}</div>
  </div>
  <div v-if="showChart" ref="container">
    <VueApexCharts v-if="chartOptions.chart" type="heatmap" :width="chartWidthValue" :height="chartHeightValue" :options="chartOptions" :series="heatmapSeries"></VueApexCharts>
  </div>
  <div v-else-if="loadingFlag" class="d-flex justify-content-center align-items-center">
    <div class="spinner-border" role="status">
      <span class="sr-only"></span>
    </div>
  </div>
  <div class="text-center p-3" v-else>
    Distanza non calcolabile.
  </div>
</template>

<style>
@import '../assets/main.css';
</style>