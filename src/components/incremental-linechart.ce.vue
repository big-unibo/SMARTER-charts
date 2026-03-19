<script setup>

import { Line } from "vue-chartjs";
import { ref, watchEffect } from "vue";
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

const props = defineProps({
  config: {
    type: Object,
    required: true
  },
  endpoint: String,
  yTitle: String,
  label: String,
  color: String
});

const chartData = ref(null)
const options = ref(null)
const data = ref(new Array(20).fill(0))
const yUnit = ref(null)
const loadingFlag = ref(false)

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, TimeScale)

watchEffect(async () => {
  if (props.config) {
    await mountChart()
  }
});

function addValueAndMaintainSize(value) {
  let newArray = [...data.value];
  newArray.shift();
  newArray.push(value);
  data.value = newArray;
}

async function mountChart() {
  const currentConfigStr = JSON.stringify(props.config)
  loadingFlag.value = true

  try {
    const chartDataResponse = await communicationService.getChartData(
      props.config.environment,
      props.config.paths,
      props.config.params,
      props.endpoint,
      "0.signals.0.measurements"
    )

    if (currentConfigStr !== JSON.stringify(props.config)) {
      return
    }

    const responseData = chartDataResponse?.data

    if (props.yTitle == null && chartDataResponse?.unit != null) {
      yUnit.value = chartDataResponse.unit
    }

    if (responseData?.[0]?.value != null) {
      addValueAndMaintainSize(responseData[0].value)
    }

    chartData.value = {
      labels: ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      datasets: [{
        data: data.value,
        borderColor: props.color,
        backgroundColor: props.color,
        label: props.label,
        pointRadius: 0,
      }]
    }

    options.value = {
      maintainAspectRatio: true,
      animation: {
        duration: 0
      },
      scales: {
        x: {
          ticks: {
            stepSize: 5
          }
        },
        y: {
          title: {
            display: true,
            text: props.yTitle || yUnit.value || '?'
          },
          min: 0
        }
      }
    }

  } catch (error) {
    console.error(error)
  } finally {
    if (currentConfigStr === JSON.stringify(props.config)) {
      loadingFlag.value = false
    }
  }
}

</script>

<template>
  <div style="height: 200px;">
    <Line v-if="chartData" :data="chartData" :options="options" />
    <div v-else>Nessun dato disponibile.</div>
  </div>
</template>

<style>
@import '../assets/main.css';
</style>