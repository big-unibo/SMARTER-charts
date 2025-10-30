<script setup>

import {Line} from "vue-chartjs";
import { ref, watchEffect} from "vue";
import 'chartjs-adapter-luxon';
import {luxonDateTime} from '../common/dateUtils.js'
import {CommunicationService} from "../services/CommunicationService.js";

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
import {LineDatasetData} from "../common/LineDatasetData.js";
import * as d3 from "d3";
import { binningColorConfig } from "@/common/colorsConfig.js";

let chartData = ref({datasets: [], labels: []})
let options = ref({responsive: true, maintainAspectRatio: false})
let showChart = ref(false)
const loadingFlag = ref(false)

const props = defineProps(['config'])
const emit = defineEmits(['selectTimestamp'])
const endpoint = 'humidityBins'


const colorFunction = (value) => {
  return binningColorConfig(value)
};

// const cleanHumidityBin = (bin) => {
//   return bin.split('*')[1].trim();
// }

const groupByHumidityBin = (bins) => {
  const totalBinTimestamp = bins.reduce((accumulator,currentValue)=>{
    const key = currentValue.timestamp
    if(!accumulator.has(key))
      accumulator.set(key, 0);
    accumulator.set(key, accumulator.get(key) + parseInt(currentValue.count))
    return accumulator;
  }, new Map());

  return bins.reduce((accumulator, currentValue) => {
    const key = {
      label: currentValue.humidityBinDescription,
      colorKey: currentValue.humidityBin 
    };
    const mapKey = JSON.stringify(key); 

    if (!accumulator.has(mapKey)) accumulator.set(mapKey, []);
    accumulator.get(mapKey).push(JSON.stringify({
      x: luxonDateTime(currentValue.timestamp),
      y: currentValue.count / totalBinTimestamp.get(currentValue.timestamp) * 100
    }));
    return accumulator;
    }, new Map());
}

const createDatasets = (entriesArray) => {
  return entriesArray.map(([mapKey, jsonValues]) => {
    const { label, colorKey } = JSON.parse(mapKey);
    return new LineDatasetData(label, jsonValues, 'origin', 0, 0.3, colorFunction, colorKey);
  });
};

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, TimeScale)

watchEffect(async () => {
  let value = props.config;
  if(value) {
    await mountChart()
  }
});

async function mountChart() {
  const configParsed = JSON.parse(props.config);

  let data = []
  showChart.value = false
  loadingFlag.value = true

  const chartDataResponse = await communicationService.getChartData(configParsed.environment, configParsed.paths, configParsed.params, endpoint, 'measures')
  if(JSON.stringify(configParsed ) !== props.config){
      return
  }
  if(chartDataResponse) {
    data = chartDataResponse.data
    showChart.value = data.length > 0
  } else {
    showChart.value = false
  }

  const groupByData = groupByHumidityBin(data);
  const sortedEntries = Array.from(groupByData.entries())
  .sort(([aKeyStr], [bKeyStr]) => {
    const aKey = JSON.parse(aKeyStr);
    const bKey = JSON.parse(bKeyStr);
    return aKey.colorKey - bKey.colorKey;
  });
  emit('selectTimestamp',Math.max(...data.map(e=>e.timestamp),0))

  chartData.value = {
    datasets: createDatasets(sortedEntries).map(bin => bin.getDataSet())
  }

  options.value = {
    responsive: true,
    maintainAspectRatio: false,
    parsing: {
      xAxisKey: 'x',
      yAxisKey: 'y'
    },
    plugins: {
      filler: {
        propagate: false
      },
      legend: {
        labels: {
          boxWidth: 2
        }
      },
      tooltip: {
        callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.parsed.y.toFixed(2) + '%'; // Format y-value as percentage
                }
                return label;
              }
            }
      }
    },
    tooltips: {
      mode: 'index',
      intersect: true
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    layout: {
      padding: 20
    },
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
          source: 'auto'
        },
        title: {
          display: true,
          text: 'Tempo'
        }
      },
      y: {
        type: 'linear',
        ticks: {
            callback: function(value, index, values) {
                return value + '%'; // Add percentage sign to y-axis labels
            },
            stepSize: 20,
        },
        stacked: true,
        title: {
          display: true,
          text: '% Celle'
        },
        min: 0,
        max: 100
      }
    },
    onClick: function handleClick(event, array) {
      if (array.length > 0) {
        const timestamp = array[0].element.$context.parsed.x / 1000
        emit('selectTimestamp',timestamp)
      }
    }
  }
  loadingFlag.value = false
}

</script>

<template>
  <div v-if="showChart">
    <Line style="height: 300px" :data="chartData" :options="options" ref="myChart"/>
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