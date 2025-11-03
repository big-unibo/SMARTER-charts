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

// const groupByType = (data) => {
//   return data.reduce((accumulator, currentValue) => {
//     const key = currentValue.signalTypeDescription
//     if(!accumulator.has(key))
//       accumulator.set(key, []);

//     accumulator.get(key).push(JSON.stringify({ x: luxonDateTime(currentValue.timestamp), y: Number(currentValue.value).toFixed(2) }));
//     return accumulator;
//   }, new Map());
// }

// const createDatasets = (groupedMeasures) => {
//   return Array.from(groupedMeasures, ([key, jsonValues]) => {
//     return new BarDatasetData(key, jsonValues, 'y', colorFunction);
//   });
// };

const createDatasets = (data) => {
  const datasets = [];

  data.forEach(signalType => {
    const type = signalType.signalTypeDescription;
    const unit = signalType.signals?.[0]?.unit || '';
    const label = unit ? `${type} (${unit})` : type;

    const dataPoints = signalType.signals
      .flatMap(signal =>
        signal.measurements.map(m =>
          JSON.stringify({
            x: luxonDateTime(m.timestamp),
            y: Number(m.value).toFixed(2)
          })
        )
      );

    datasets.push(new BarDatasetData(label, dataPoints, 'y', signalsColorFunction, type));
  });

  return datasets;
};


const getTotalGroups = data =>
  new Map(
    (Array.isArray(data) ? data : []).map(type => {
      const total = type.signals?.flatMap(s => s.measurements || [])
        .reduce((sum, m) => sum + Number(m?.value || 0), 0);

      const unit = type.signals?.[0]?.unit || '';
      return [type.signalTypeDescription, { total, unit }];
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
  const configParsed = JSON.parse(props.config);

  let data = []
  showChart.value = false
  loadingFlag.value = true
  
  const chartDataResponse = await communicationService.getChartData(configParsed.environment, configParsed.paths, configParsed.params, endpoint)
  if (JSON.stringify(configParsed) !== props.config) {
    return
  }
  if (chartDataResponse) {
    data = chartDataResponse
    showChart.value = data.length > 0
  } else data = []

  totalGroups.value = getTotalGroups(data)
  unitGroups.value = getUnitGroups(totalGroups.value);

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
        di = legendItem.datasetIndex
        myBarChart.data.datasets[di].hidden = !myBarChart.data.datasets[di].hidden;
        myBarChart.options.scales.yAxes[0].ticks.suggestedMax = getMax(myBarChart) + 100;
        myBarChart.update()
      }
    }
  }
  loadingFlag.value = false
}



</script>

<template>
  <div v-if="unitGroups && unitGroups.size" class="p-2" style="padding-left: 20px; padding-top: 10px;">
    <template v-for="([unit, types], i) in Array.from(unitGroups)" :key="unit">
      <p class="mb-1">
        <b>{{ types.join(', ') }}</b>
        espress{{ types.length > 1 ? 'i' : 'o' }} in <b>{{ unit }}</b>
      </p>
    </template>
  </div>

  <div class="d-flex flex-wrap justify-content-end">
    <div v-for="([group, { unit, total }]) in totalGroups" :key="group" class="px-2 p-1 m-1 mx-auto"
      :style="{ backgroundColor: signalsColorFunction(group), borderColor: signalsColorFunction(group), borderRadius: '8px', borderWidth: '1px', borderStyle: 'solid' }">
      <div>Totale {{ group }}: {{ total.toFixed(2) }} ({{ unit }})</div>
    </div>
  </div>
  <div class="card-body">
    <div v-if="showChart">
      <Bar style="height: 320px;" :data="chartData" :options="options" />
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