<script setup>

import { Line } from "vue-chartjs";
import { ref, watchEffect } from "vue";
import 'chartjs-adapter-luxon';
import { luxonDateTime } from '../common/dateUtils.js'
import { CommunicationService } from "../services/CommunicationService.js";
import { Colors } from 'chart.js';

const communicationService = new CommunicationService();

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
import { groundWaterPotentialColorFunction } from "@/common/colorsConfig.js";

const chartData = ref({ datasets: [], labels: [] })
const options = ref({ responsive: true, maintainAspectRatio: false })
const showChart = ref(false)
const loadingFlag = ref(false)

const unitLabel = ref(null);

const props = defineProps(['config', 'extraParams', 'hideOnMissingSignal'])

const endpoint = 'signals'

const createDatasets = (data) => {
  const datasets = [];
  data.forEach(signalType => {
    signalType.signals.sort((a, b) => {
        if (a.x === b.x) {
            return b.y - a.y; 
        }
        return a.x - b.x; 
    });
    signalType.signals.forEach((signal, index) => {
      const label = `${signalType.signalTypeDescription} (${signal.x}, ${signal.y})`;


      if (unitLabel.value === null && signal?.unit != null) {
        unitLabel.value = signal.unit;
      }

      const dataPoints = signal.measurements.map(m =>
        JSON.stringify({
          x: luxonDateTime(m.timestamp),
          y: Number(m.value).toFixed(2)
        })
      );

      const sortingKey = {
        x: signal.x,
        y: signal.y
      }
      datasets.push(new LineDatasetData(label, dataPoints, false, 3, 0.3, groundWaterPotentialColorFunction, index, sortingKey));
    });
  });
  return datasets
}

ChartJS.register(Colors);
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, TimeScale)

watchEffect(async () => {
  let value = props.config;
  if (value) {
    await mountChart()
  }
});

async function mountChart() {
  const currentConfigStr = props.config
  showChart.value = false
  loadingFlag.value = true
  unitLabel.value = null

  try {
    const configParsed = JSON.parse(props.config)
    const extraParamsParsed = JSON.parse(props.extraParams)
    const mergedParams = {
      ...configParsed.params,
      ...extraParamsParsed
    }

    const chartDataResponse = await communicationService.getChartData(
      configParsed.environment,
      configParsed.paths,
      mergedParams,
      endpoint
    )

    if (currentConfigStr !== props.config) {
      return
    }

    let data = []
    if (chartDataResponse) {
      data = chartDataResponse
      showChart.value = data.length > 0
    }

    const datasets = createDatasets(data).map(bin => bin.getDataSet()).sort((a, b) => {
      if (a.sortingKey.x === b.sortingKey.x) {
        return b.sortingKey.y - a.sortingKey.y
      }
      return a.sortingKey.x - b.sortingKey.x
    })

    chartData.value = {
      datasets: datasets
    }

    const yLabel = unitLabel.value || "sconosciuto"

    options.value = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            boxWidth: 2,
          }
        }
      },
      parsing: {
        xAxisKey: 'x',
        yAxisKey: 'y'
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
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
          title: {
            display: true,
            text: yLabel
          },
          ticks: {
            autoSkip: true,
            maxTicksLimit: 10
          },
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
  <div v-if="showChart">
   <Line :data="chartData" :options="options" />
  </div>
  <div v-else-if="!props.hideOnMissingSignal">
    <div v-if="loadingFlag" class="d-flex justify-content-center align-items-center">
      <div class="spinner-border" role="status">
        <span class="sr-only"></span>
      </div>
    </div>
    <div v-else>Nessun dato disponibile.</div>
  </div>
</template>

<style>
@import '../assets/main.css';
</style>