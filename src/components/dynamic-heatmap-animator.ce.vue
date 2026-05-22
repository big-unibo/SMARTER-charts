<script setup>

import '../assets/animator.css'

import { ref, watchEffect } from 'vue';
import IncrementalLinearChart from "./incremental-linechart.ce.vue";
import { CommunicationService } from "../services/CommunicationService.js";
import DynamicHeatmap from "../components/dynamic-heatmap.ce.vue";

const buttonTexts = {
  start: 'Start',
  resume: 'Resume',
  stop: 'Stop'
}

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})

const heatmapAnimatorConfig = ref(null)
const linechartAnimatorConfig = ref(null)

const communicationService = new CommunicationService();
const endpoint = 'humidityBins'

const data = ref([]);
const timestamps = ref(new Set());
const timestampsArray = ref([]);
const currentTimestamp = ref('');
const currentIndex = ref(0);
const interval = ref(null);
const animationSpeed = ref(300);
const isPlaying = ref(false);
const buttonText = ref(buttonTexts.start);
const currentDate = ref('');

const loadingFlag = ref(false)

function updateHeatmapConfig(firstTimestamp, lastTimestamp) {
  const parsedConfig = JSON.parse(props.config)
  heatmapAnimatorConfig.value = {
    environment: parsedConfig.environment,
    paths: parsedConfig.paths,
    params: {
      timeFilterFrom: firstTimestamp,
      timeFilterTo: lastTimestamp
    }
  }
}

function updateLinechartConfig(currentTimestamp, lastTimestamp) {
  const parsedConfig = JSON.parse(props.config)
  linechartAnimatorConfig.value = {
    environment: parsedConfig.environment,
    paths: parsedConfig.paths,
    params: {
      timeFilterFrom: (Number(lastTimestamp) + 1),
      timeFilterTo: currentTimestamp
    }
  }
}

async function calculateTimestampLength() {
  const currentConfigStr = props.config
  const configParsed = JSON.parse(props.config)
  loadingFlag.value = true

  try {
    const chartDataResponse = await communicationService.getChartData(
      configParsed.environment,
      configParsed.paths,
      configParsed.params,
      endpoint,
      "measures"
    )

    if (currentConfigStr !== props.config) {
      return
    }

    if (chartDataResponse) {
      data.value = chartDataResponse.data
      timestamps.value = new Set()
    } else {
      data.value = []
    }

    data.value.forEach(d => {
      timestamps.value.add(d.timestamp)
    })

    timestampsArray.value = Array.from(timestamps.value).sort((a, b) => a - b)

  } catch (error) {
    console.error(error)
  } finally {
    if (currentConfigStr === props.config) {
      loadingFlag.value = false
    }
  }
}

function startLoop() {
  const arr = timestampsArray.value;

  interval.value = setInterval(() => {
    currentTimestamp.value = arr[currentIndex.value];
    currentDate.value = new Date(currentTimestamp.value * 1000).toLocaleDateString('it-IT');

    const prevIndex = currentIndex.value > 0 ? currentIndex.value - 1 : 0;
    updateLinechartConfig(arr[currentIndex.value], arr[prevIndex]);
    currentIndex.value++;

    if (currentIndex.value >= arr.length) {
      stopLoop();
      reset();
    }
  }, animationSpeed.value);
}

function stopLoop() {
  clearInterval(interval.value);
  interval.value = null;
  isPlaying.value = false;
}

function reset() {
  clearInterval(interval.value)
  isPlaying.value = false
  interval.value = null
  currentIndex.value = 0
  currentTimestamp.value = ''
  currentDate.value = ''
  buttonText.value = buttonTexts.start
}

function onClickPlayButton() {
  isPlaying.value = !isPlaying.value;
  buttonText.value = isPlaying.value ? buttonTexts.stop : currentIndex.value > 0 ? buttonTexts.resume : buttonTexts.start;
  isPlaying.value ? startLoop() : stopLoop();
}

function changeAnimationSpeed(value) {
  if (isPlaying.value) {
    stopLoop();
    animationSpeed.value = value;
    buttonText.value = currentIndex.value > 0 ? buttonTexts.resume : buttonTexts.start
  } else {
    animationSpeed.value = value;
  }
}

function selectTimestamp(index) {
  currentIndex.value = index;
  const arr = timestampsArray.value;
  const prevIndex = index > 0 ? index - 1 : 0;
  currentTimestamp.value = arr[index];
  currentDate.value = new Date(arr[index] * 1000).toLocaleDateString('it-IT');
  updateLinechartConfig(arr[index], arr[prevIndex]);
  buttonText.value = buttonTexts.resume
  stopLoop();
}

function getLeftOffset(dataLen, index) {
  return 100 / (dataLen - 1) * index;
}

watchEffect(async () => {
  await calculateTimestampLength();
  if (timestampsArray.value.length > 0) {
    updateHeatmapConfig(timestampsArray.value[0], timestampsArray.value[timestampsArray.value.length - 1])
    updateLinechartConfig(timestampsArray.value[0], timestampsArray.value[0] - 1 )
  }
});

</script>

<template>
  <div v-if="timestamps.size > 0" class="card">
    <div class="card-body">
      <div class="timeline-placeholder">
        <div class="timeline-wrapper">
          <button id="dynamic-heatmap-play-button" @click="onClickPlayButton">{{ buttonText }}</button>
          <div class="heatmap-timeline">
            <div v-for="(timestamp, index) in Array.from(timestamps)" :key="timestamp" class="time-point"
              :class="{ 'active': currentIndex === index }" @click="selectTimestamp(index)"
              :style="{ left: getLeftOffset(timestamps.size, index) + '%' }"></div>
          </div>
        </div>
      </div>

      <div class="row animator-controllers justify-content-end">
        <div class="col-auto">
          <button type="button" class="btn btn-secondary" @click="changeAnimationSpeed(500)">Bassa</button>
        </div>
        <div class="col-auto">
          <button type="button" class="btn btn-secondary" @click="changeAnimationSpeed(300)">Media</button>
        </div>
        <div class="col-auto">
          <button type="button" class="btn btn-secondary" @click="changeAnimationSpeed(200)">Veloce</button>
        </div>
      </div>

      <div class="charts-wrapper row">
        <div class="heatmap-dataviz col-6">
          <DynamicHeatmap style="margin-left: -10px" :config="JSON.stringify(heatmapAnimatorConfig)"
            :selectedTimestamp="currentTimestamp"></DynamicHeatmap>
        </div>
        <div class="col-1">
          <p></p>
        </div>
        <div class="line_charts col-5">
          <IncrementalLinearChart style="height: 200px" :config="JSON.stringify({...linechartAnimatorConfig, params: {...linechartAnimatorConfig.params ?? {}, signalTypes: ['DRIPPER']}})" 
            :endpoint="'signals'" :label="'Dripper'"
            :color="'rgb(31, 119, 180)'"></IncrementalLinearChart>
          <IncrementalLinearChart style="height: 200px" :config="JSON.stringify({...linechartAnimatorConfig, params: {...linechartAnimatorConfig.params ?? {}, signalTypes: ['PLUV_CURR']}})"
            :endpoint="'signals'" :label="'Pluv'"
            :color="'rgb(31, 119, 180)'"></IncrementalLinearChart>
        </div>
      </div>
    </div>
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
@import '../assets/animator.css';
</style>