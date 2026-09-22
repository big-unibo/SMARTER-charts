<script setup>

import { Line } from "vue-chartjs";
import { ref, watchEffect } from "vue";
import 'chartjs-adapter-luxon';
import { luxonDateTime } from '../common/dateUtils.js'
import { CommunicationService } from "../services/CommunicationService.js";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale
} from 'chart.js'
import { LineDatasetData } from "../common/LineDatasetData.js";
import { optimalDistanceColorFunction } from '@/common/colorsConfig.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, TimeScale)

const communicationService = new CommunicationService();

const chartData = ref({ datasets: [], labels: [] })
const options = ref({ responsive: true, maintainAspectRatio: false })
const showChart = ref(false)
const loadingFlag = ref(false)

const props = defineProps(['config'])

const endpoint = 'optimalDistance'

const OPTIMAL_RANGE_MAX_TYPE = 'Massimo ottimale'
const OPTIMAL_RANGE_MIN_TYPE = 'Minimo ottimale'


const OPTIMAL_RANGE_MAX_LABEL = 'Fascia ottimale (max)'
const OPTIMAL_RANGE_MIN_LABEL = 'Fascia ottimale (min)'

const createDatasets = (data) => {
  const datasets = [];

  data.forEach(signalType => {
    const type = signalType.valueType;
    const unit = signalType.signals?.[0]?.unit || '';
    const label = unit ? `${type} (${unit})` : type;

    const dataPoints = signalType.values
      .map(m =>
        JSON.stringify({
          x: luxonDateTime(m.timestamp),
          y: Number(m.value).toFixed(2)
        })
      );

    datasets.push(new LineDatasetData(label, dataPoints, 'false', 2, 0.2, optimalDistanceColorFunction, type));
  });

  return datasets;
};

const toChartData = (values) => values.map(v => ({
  x: v.timestamp * 1000, // secondi → millisecondi
  y: v.value
}))

// Dataset "ombra" invisibili in legenda, usati solo per disegnare
// il riempimento tra Massimo ottimale e Minimo ottimale.
const buildOptimalRangeFillDatasets = (data) => {
  const maxSeries = data.filter(({ valueType }) => valueType === OPTIMAL_RANGE_MAX_TYPE)[0]?.values ?? []
  const minSeries = data.filter(({ valueType }) => valueType === OPTIMAL_RANGE_MIN_TYPE)[0]?.values ?? []

  return [
    {
      label: OPTIMAL_RANGE_MAX_LABEL,
      data: toChartData(maxSeries),
      borderColor: 'transparent',
      borderWidth: 0,
      pointRadius: 0,
      backgroundColor: 'rgba(76, 175, 80, 0.2)',
      fill: '+1' // riempie fino al dataset successivo (fascia min)
    },
    {
      label: OPTIMAL_RANGE_MIN_LABEL,
      data: toChartData(minSeries),
      borderColor: 'transparent',
      borderWidth: 0,
      pointRadius: 0,
      fill: false
    }
  ]
}

watchEffect(async () => {
  let value = props.config;
  if (value) {
    await mountChart()
  }
});

async function mountChart() {
  const currentConfigStr = props.config
  const configParsed = JSON.parse(props.config)
  showChart.value = false
  loadingFlag.value = true

  try {
    const chartDataResponse = await communicationService.getChartData(
      configParsed.environment,
      configParsed.paths,
      configParsed.params,
      endpoint
    )

    if (currentConfigStr !== props.config) {
      return
    }

    let data = []
    if (chartDataResponse) {
      data = chartDataResponse
    }

    if (!data || data.length === 0) {
      showChart.value = false
      return
    }

    showChart.value = true

    const wetLevel = Math.min(...data.filter(({_, valueType}) => valueType === 'Capacità di campo')[0]?.values.map(({value, _}) => value))
    const dryLevel = Math.max(...data.filter(({_, valueType}) => valueType === 'Asciutto')[0]?.values.map(({value, _}) => value))

    const unit = data[0]?.unit ?? "N/A"

    const lineDatasets = createDatasets(
      data.filter(({_, valueType}) =>
        valueType !== 'Asciutto' &&
        valueType !== 'Capacità di campo' &&
        valueType !== OPTIMAL_RANGE_MAX_TYPE &&
        valueType !== OPTIMAL_RANGE_MIN_TYPE
      )
    ).map(bin => bin.getDataSet())


    const optimalRangeFillDatasets = buildOptimalRangeFillDatasets(data)
    
    const datasets = [
      ...optimalRangeFillDatasets,
      ...lineDatasets
    ]

    chartData.value = {
      datasets: datasets
    }

    options.value = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            filter: (legendItem) => ![OPTIMAL_RANGE_MAX_LABEL, OPTIMAL_RANGE_MIN_LABEL].includes(legendItem.text)
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'hour',
            tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
            displayFormats: {
              minute: 'yyyy-MM-dd HH:mm',
              second: 'yyyy-MM-dd',
              hour: 'yyyy-MM-dd',
              day: 'yyyy-MM-dd',
              month: 'yyyy-MM'
            },
          },
          ticks: {
            source: 'data'
          },
          title: {
            display: true,
            text: 'Tempo'
          }
        },
        y: {
          position: 'left',
          title: {
            display: true,
            text: unit
          },
          suggestedMin: dryLevel,
          suggestedMax: wetLevel
        }
      }
    }

  } catch (error) {
    console.error(error)
    showChart.value = false
  } finally {
    if (currentConfigStr === props.config) {
      loadingFlag.value = false
    }
  }
}

</script>

<template>
  <div v-if="showChart" class="chart-container">
    <Line :data="chartData" :options="options" />
  </div>
  <div v-else-if="loadingFlag" class="d-flex justify-content-center align-items-center">
    <div class="spinner-border" role="status">
      <span class="sr-only"></span>
    </div>
  </div>
  <div v-else>Nessun dato disponibile.</div>
</template>

<style>
@import '../assets/main.css';
</style>