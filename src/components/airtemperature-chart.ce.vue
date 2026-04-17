<script setup>

import { Line } from "vue-chartjs";
import { ref, watchEffect } from "vue";
import 'chartjs-adapter-luxon';
import { luxonDateTime } from '../common/dateUtils.js'
import { CommunicationService } from "../services/CommunicationService.js";

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
import { signalsColorFunction } from "@/common/colorsConfig.js";

const props = defineProps(['config'])

const endpoint = 'signals'

const chartData = ref({ datasets: [], labels: [] })
const options = ref({ responsive: true, maintainAspectRatio: false })
const showChart = ref(false)
const loadingFlag = ref(false)

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, TimeScale)

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
      endpoint,
      "0.signals.0.measurements"
    );

    if (currentConfigStr !== JSON.stringify(props.config)) {
      return
    }

    let unit = "C°"
    let data = []

    if (chartDataResponse && Array.isArray(chartDataResponse.data)) {
      data = chartDataResponse.data
      unit = chartDataResponse.unit ?? unit
      showChart.value = data.length > 0
    } else {
      loadingFlag.value = false
      return
    }

    chartData.value = {
      datasets: [{
        data: data.map(d => ({
          timestamp: Number(d.timestamp) * 1000,
          value: d.value
        })),
        borderColor: signalsColorFunction('Air Temperature'),
        backgroundColor: signalsColorFunction('Air Temperature'),
        label: "AirTemp"
      }]
    }

    options.value = {
      responsive: true,
      maintainAspectRatio: false,
      parsing: {
        xAxisKey: 'timestamp',
        yAxisKey: 'value'
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
            text: unit
          }
        }
      }
    }

  } catch (error) {
    console.error("Errore mountChart:", error)
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