<script setup>

import { Line } from "vue-chartjs";
import { ref, watchEffect, watch, nextTick, onBeforeUnmount } from "vue";
import 'chartjs-adapter-luxon';
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

const chartContainer = ref(null);
const isCompact = ref(window.innerWidth < 500);

const resizeObserver = new ResizeObserver(([entry]) => {
  isCompact.value = entry.contentRect.width < 500;
});

watch(chartContainer, async (el, oldEl) => {
  if (oldEl) {
    resizeObserver.unobserve(oldEl);
  }

  if (el) {
    await nextTick();
    resizeObserver.observe(el);
  }
});


onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

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
  const currentConfigStr = props.config
  const configParsed = JSON.parse(props.config)

  showChart.value = false
  loadingFlag.value = true

  try {
    const chartDataResponse = await communicationService.getChartData(
      configParsed.environment,
      configParsed.paths,
      configParsed.params,
      endpoint,
      "0.signals.0.measurements"
    );

    if (currentConfigStr !== props.config) {
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
      elements: {
        point: {
          hoverRadius: isCompact.value ? 2 : 3,
          radius: 2,
          hitRadius: 4,
          borderWidth: 2,
          pointStyle: isCompact.value ? false : 'circle',
          hoverBorderWidth: 3
        },
        line: {
          borderWidth: isCompact.value ? 1 : 3
        }
      },
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
            source: 'data',
            font: {
              size: isCompact.value ? 10 : 12
            }
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
          },
          ticks: {
            autoSkip: true,
            maxTicksLimit: 10,
            font: {
              size: isCompact.value ? 10 : 12
            }
          },
        }
      }
    }

  } catch (error) {
    console.error("Errore mountChart:", error)
    showChart.value = false
  } finally {
    if (currentConfigStr === props.config) {
      loadingFlag.value = false
    }
  }
}

</script>

<template>
  <div v-if="showChart" class="chart-container" ref="chartContainer">
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