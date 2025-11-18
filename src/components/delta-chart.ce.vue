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
import { deltaColorFunction } from '@/common/colorsConfig.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, TimeScale)

const communicationService = new CommunicationService();

const chartData = ref({ datasets: [], labels: [] })
const options = ref({ responsive: true, maintainAspectRatio: false })
const showChart = ref(false)
const loadingFlag = ref(false)

const props = defineProps(['config'])

const endpoint = 'delta'

// const groupByType = (measures) => {
//   return measures.reduce((accumulator, currentValue) => {
//     const key = currentValue.detectedValueTypeDescription
//     if(!accumulator.has(key))
//       accumulator.set(key, []);
//     accumulator.get(key).push(JSON.stringify({x: luxonDateTime(currentValue.timestamp), y: Number(currentValue.value).toFixed(2)}));
//     return accumulator;
//   }, new Map());
// }

// const createDatasets = (groupedMeasures) => {
//   return Array.from(groupedMeasures, ([key, jsonValues]) => {
//     return new LineDatasetData(key, jsonValues, false, 2, 0.2, colorFunction);
//   });
// };

const createDatasets = (data) => {
  const datasets = [];

  data.forEach(signalType => {
    const type = signalType.detectedValueTypeDescription;
    const unit = signalType.signals?.[0]?.unit || '';
    const label = unit ? `${type} (${unit})` : type;

    const dataPoints = signalType.values
      .map(m =>
        JSON.stringify({
          x: luxonDateTime(m.timestamp),
          y: Number(m.value).toFixed(2)
        })
      );

    datasets.push(new LineDatasetData(label, dataPoints, 'false', 2, 0.2, deltaColorFunction, type));
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
  const configParsed = JSON.parse(props.config);
  let data = []

  showChart.value = false
  loadingFlag.value = true

  try {
    const chartDataResponse = await communicationService.getChartData(configParsed.environment, configParsed.paths, configParsed.params, endpoint, 'measures');

    if (JSON.stringify(configParsed) !== props.config) {
      return
    }

    if (chartDataResponse) {
      data = chartDataResponse
      showChart.value = data.length > 0
      loadingFlag.value = !(data.length > 0)
    } else {
      showChart.value = false;
      data = []
    }

  } catch (error) {
    console.error("Errore nel recupero dati:", error);
    showChart.value = false;
  } finally {
    loadingFlag.value = false;
  }

  if (!showChart.value) {
    return;
  }

  const unit = data[0]?.unit ?? "N/A";

  //const groupByData = groupByType(data);

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
            minute: 'yyyy-MM-dd HH:mm', // Customize the display format for minutes
            second: 'yyyy-MM-dd HH:mm', // Customize the display format for seconds,
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
  loadingFlag.value = false
}

</script>

<template>
  <div v-if="showChart">
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