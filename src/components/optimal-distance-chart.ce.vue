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

watchEffect(async () => {
  let value = props.config;
  if (value) {
    await mountChart()
  }
});

async function mountChart() {
  const currentConfigStr = JSON.stringify(props.config)
  showChart.value = false
  loadingFlag.value = true

  try {
    const chartDataResponse = await communicationService.getChartData(
      props.config.environment,
      props.config.paths,
      props.config.params,
      endpoint
    )

    if (currentConfigStr !== JSON.stringify(props.config)) {
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

    const unit = data[0]?.unit ?? "N/A"
    const datasets = createDatasets(data).map(bin => bin.getDataSet())

    chartData.value = {
      datasets: datasets
    }

    options.value = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
            tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
            displayFormats: {
              minute: 'yyyy-MM-dd HH:mm',
              second: 'yyyy-MM-dd HH:mm',
              hour: 'yyyy-MM-dd HH:mm:ss',
              day: 'yyyy-MM-dd',
              month: 'yyyy-MM-dd HH:mm:ss'
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
        }
      }
    }

  } catch (error) {
    console.error(error)
    showChart.value = false
  } finally {
    if (currentConfigStr === JSON.stringify(props.config)) {
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