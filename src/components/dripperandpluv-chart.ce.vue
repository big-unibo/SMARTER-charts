<script setup>

import {Line} from "vue-chartjs";
import {ref, watchEffect} from "vue";
import 'chartjs-adapter-luxon';
import {luxonDateTime} from '../common/dateUtils.js'
import {CommunicationService} from "../services/CommunicationService.js";
import {MultiAxisLineDatasetData} from "../common/MultiAxisLineDatasetData.js";

import { signalsColorFunction } from '@/common/colorsConfig.js';


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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, TimeScale)


const chartData = ref({datasets: [], labels: []})
const options = ref({responsive: true, maintainAspectRatio: false})
const showChart = ref(false)
const loadingFlag = ref(false)

const pluvCurrUnit = ref(null)
const dripperUnit = ref(null)

const props = defineProps(['config', 'extraParams'])

const endpoint = 'signals'

const createDatasets = (data) => {
  const datasets = [];

  data.forEach(signalType => {
    const type = signalType.signalTypeDescription;
    const unit = signalType.signals?.[0]?.unit || '';
    const label = unit ? `${type} (${unit})` : type;
    const yAxisID = ['Dripper', 'Sprinkler'].includes(type) ? 'y' : 'y1';

    if (dripperUnit.value === null && ['Dripper', 'Sprinkler'].includes(type))
      dripperUnit.value = unit;
    else if (pluvCurrUnit.value === null  && type === 'Pluv Curr')
      pluvCurrUnit.value = unit;

    const dataPoints = signalType.signals
      .flatMap(signal =>
        signal.measurements.map(m =>
          JSON.stringify({
            x: luxonDateTime(m.timestamp),
            y: Number(m.value).toFixed(2)
          })
        )
      );

    datasets.push(new MultiAxisLineDatasetData(label, dataPoints, yAxisID, signalsColorFunction, type));
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
  const extraParamsParsed = JSON.parse(props.extraParams)
  const mergedParams = {
    ...configParsed.params,
    ...extraParamsParsed 
  };

  let data = []
  showChart.value = false
  loadingFlag.value = true

  const chartDataResponse = await communicationService.getChartData(
    configParsed.environment,
    configParsed.paths,
    mergedParams,
    endpoint
  );

  if(JSON.stringify(configParsed) !== props.config){
      return
  }

  if (chartDataResponse) {
    data = chartDataResponse
    showChart.value = data.length > 0
  } else data = []

  const datasets = createDatasets(data).map(bin => bin.getDataSet())

  const yLabel = dripperUnit.value || "L";
  const y1Label = pluvCurrUnit.value || "mm";

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
          text: yLabel
        },
        position: 'left',
      },
      y1: {
        beginAtZero: true,
        position: 'right',
        title: {
          display: true,
          text: y1Label
        },
      }
    }
  }
  loadingFlag.value = false
}

</script>

<template>
  <div v-if="pluvCurrUnit || dripperUnit" class="p-2" style="padding-left: 20px; padding-top: 10px;">
    <p v-if="pluvCurrUnit" class="mb-1">
      <b>Pluv Curr</b> espresso in <b>{{ pluvCurrUnit }}</b>
    </p>
    <p v-if="dripperUnit" class="mb-1">
      <b>Dripper</b>, <b>Sprinkler</b> espressi in <b>{{ dripperUnit }}</b>
    </p>
  </div>
  
  <div class="card-body">
    <div v-if="showChart">
      <Line style="height: 320px;" :data="chartData" :options="options"/>
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