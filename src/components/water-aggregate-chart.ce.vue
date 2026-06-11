<script setup>

import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  TimeScale
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import { ref, watchEffect } from "vue";
import 'chartjs-adapter-luxon';
import { luxonDateTime } from '../common/dateUtils.js'
import { CommunicationService } from "../services/CommunicationService.js";
import { BarDatasetData } from "../common/BarDatasetData.js";
import { signalsColorFunction } from '@/common/colorsConfig.js';

const communicationService = new CommunicationService();

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, TimeScale)

const chartData = ref({ datasets: [], labels: [] })
const options = ref({ responsive: true, maintainAspectRatio: false })
const showChart = ref(false)
const loadingFlag = ref(false)

const props = defineProps(['config', 'extraParams'])

const endpoint = 'waterAggregate'

const totalGroups = ref(null)
const unitGroups = ref(null)

const createDatasets = (data) => {
  const datasets = [];

  data.forEach(signalType => {
    const type = signalType.signalTypeDescription;

    signalType.signals.forEach(signal => {
      const label = type + (signal.sensorTechnology ? `(${signal.sensorTechnology})` : '')
      const dataPoints = signal.measurements.map(m =>
        JSON.stringify({
          x: luxonDateTime(m.timestamp),
          y: Number(m.value).toFixed(2)
        })
      );

      datasets.push(new BarDatasetData(label, dataPoints, 'y', signalsColorFunction, type));
    });
  });

  return datasets;
};


const getTotalGroups = data =>
  new Map(
    (Array.isArray(data) ? data : []).flatMap(type => {
      const res = type.signals?.map(s => ([type.signalTypeDescription + (s.sensorTechnology ? `(${s.sensorTechnology})` : ''), {unit: s.unit ?? '', total: s.measurements.reduce((sum, m) => sum + Number(m?.value || 0), 0) || 0}]))
      return res;
    })
  );

const getUnitGroups = totalGroups =>
  new Map(
    Object.entries(
      Array.from(totalGroups.entries()).reduce((acc, [type, { unit }]) => {
        const u = unit || 'N/A';
        if (!acc[u]) acc[u] = [];
        acc[u].push(type);
        return acc;
      }, {})
    )
  );


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
      showChart.value = data.length > 0
    }

    totalGroups.value = getTotalGroups(data)
    unitGroups.value = getUnitGroups(totalGroups.value)

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
          beginAtZero: true,
          title: {
            display: true,
            text: ''
          },
          position: 'left',
          display: 'auto',
        }
      },
      legend: {
        onClick: function (e, legendItem) {
          const di = legendItem.datasetIndex
          myBarChart.data.datasets[di].hidden = !myBarChart.data.datasets[di].hidden
          myBarChart.options.scales.yAxes[0].ticks.suggestedMax = getMax(myBarChart) + 100
          myBarChart.update()
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
  <div v-if="unitGroups && unitGroups.size" class="px-4 py-2" style="font-size: 11px;">
    <template v-for="([unit, types], i) in Array.from(unitGroups)" :key="unit">
      <p class="mb-1">
        <b>{{ types.join(', ') }}</b>
        espress{{ types.length > 1 ? 'i' : 'o' }} in <b>{{ unit }}</b>
      </p>
    </template>
  </div>

  <div class="d-flex flex-wrap justify-content-around">
    <div v-for="([group, { unit, total }]) in totalGroups" :key="group" class="p-1 m-1"
      :style="{ backgroundColor: signalsColorFunction(group.split('(')[0]), borderColor: signalsColorFunction(group.split('(')[0]), borderRadius: '8px', borderWidth: '1px', borderStyle: 'solid', fontSize: '12px' }">
      <div>Totale {{ group }}: <strong>{{ total.toFixed(2) }}</strong> ({{ unit }})</div>
    </div>
  </div>
  <div class="card-body">
    <div v-if="showChart" class="chart-container">
      <Bar :data="chartData" :options="options" />
    </div>
    <div v-else-if="loadingFlag" class="d-flex justify-content-center align-items-center">
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