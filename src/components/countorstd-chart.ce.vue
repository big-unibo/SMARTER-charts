<script setup>
import * as d3 from "d3";
import { ref, nextTick, watchEffect } from "vue";
import { average, groupBy } from "../common/utils.js";
import { CommunicationService } from "../services/CommunicationService.js";
import { devColorFunction } from "@/common/colorsConfig.js";

const communicationService = new CommunicationService();
const chartRef = ref(null);

const props = defineProps(['config'])
const endpoint = 'profileStatistics'
const showChart = ref(false)
const loadingFlag = ref(false)
const container = ref(null)
const binningInfo = ref([])
const imageStyle = ref({ width: "", height: "" })

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

  let axisX = []
  let axisY = []
  let std = []

  try {
    const chartDataResponse = await communicationService.getChartData(configParsed.environment, configParsed.paths, configParsed.params, endpoint, 'measures')

    if (currentConfigStr !== props.config || !chartDataResponse?.data?.length) {
      return
    }

    const data = chartDataResponse.data
    const binningId = chartDataResponse.binningId;

    binningInfo.value = await communicationService.getBinningInfo(
      configParsed.environment,
      binningId,
      'bins'
    );

    if (currentConfigStr !== props.config) return;

    data.sort((a, b) => {
      if (a.z !== b.z) return a.z - b.z;
      if (a.y !== b.y) return b.y - a.y;
      return a.x - b.x;
    });

    const Z = data.map(d => d.z);
    const z_unique = [...new Set(Z)];

    if (z_unique.length <= 2) {
      data.forEach(d => {
        axisY.push(d.y)
        axisX.push(d.x)
        std.push(Number(d.std))
      });
    } else {
      const dataTemp = groupBy(data, t => t.y);
      for (const [key, value] of Object.entries(dataTemp)) {
        let dataTemp2 = groupBy(value, e => e.x)
        for (const [key2, value2] of Object.entries(dataTemp2)) {
          let stds_to_std = []
          let temp_y, temp_x
          value2.forEach(d => {
            stds_to_std.push(parseFloat(d.std))
            temp_x = d.x;
            temp_y = d.y;
          });
          axisY.push(temp_y)
          axisX.push(temp_x)
          std.push(average(stds_to_std))
        }
      }
    }

    showChart.value = true

  } catch (error) {
    console.error(error)
    showChart.value = false
    return
  } finally {
    if (currentConfigStr === props.config) {
      loadingFlag.value = false
    }
  }

  if (!showChart.value) {
    return
  }

  let margin = { top: 10, bottom: 35, left: 47, right: 100 }

  const numCellInWidth = ((Math.max(...axisX) - Math.min(...axisX)) / 5) + 1
  const numCellInHeight = (((Math.min(...axisY) * -1) - (Math.max(...axisY) * -1)) / 5) + 1

  if (!container.value) {
    await nextTick()
  }

  const containerWidth = container.value.offsetWidth
  let cellSize
  if (numCellInWidth > numCellInHeight) {
    cellSize = (containerWidth - margin.left - margin.right) / numCellInWidth
  } else {
    cellSize = (containerWidth - margin.left - margin.right) / numCellInHeight
  }

  let width = cellSize * numCellInWidth + margin.left + margin.right
  let height = cellSize * numCellInHeight + margin.top + margin.bottom

  imageStyle.value.width = width + "px"
  imageStyle.value.height = height + "px"

  let svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  width -= margin.left + margin.right
  height -= margin.top + margin.bottom

  let x = d3.scaleLinear()
    .domain([Math.min(...axisX), Math.max(...axisX)])
    .range([0, width]);
  svg.append("g").attr("transform", "translate(0," + height + ")").call(d3.axisBottom(x));

  let y = d3.scaleLinear()
    .domain([Math.max(...axisY), Math.min(...axisY)])
    .range([0, height]);
  svg.append("g").call(d3.axisLeft(y));

  const stdMin = d3.min(std)
  const stdMax = d3.max(std)

  const maxStd = (Math.max(...binningInfo.value.map(b => b.upperBound)) - Math.min(...binningInfo.value.map(b => b.lowerBound))) / 2

  const step = 0.015
  const colorRanges = Array.from({ length: 7 }, (_, i) => ({
    from: i * step * maxStd,
    to: i === 6 ? maxStd : (i + 1) * step * maxStd,
    color: devColorFunction(i + 1)
  }));

  const mycolor = function (d) {
    for (const r of colorRanges) {
      if (d >= r.from && d < r.to) return r.color;
    }
  };

  const ticks2 = colorRanges.map(r => r.from)
  const ticksLabels2 = colorRanges.map(r => `[${r.from}, ${r.to})`)


  const contours = d3.contours()
    .size([numCellInWidth, numCellInHeight])
    .thresholds(d3.range(Math.floor(stdMin), Math.ceil(stdMax) + maxStd*0.001, maxStd*0.001));

  // Function to scale contours coordinates
  const scaleCoordinates = (geometry) => {
    geometry.coordinates = geometry.coordinates.map(polygon =>
      polygon.map(ring =>
        ring.map(([x, y]) => [x * (width / numCellInWidth), y * (height / numCellInHeight)])
      )
    );
    return geometry;
  };

  svg.selectAll(".contourstd")
    .data(contours(std).map(feature => scaleCoordinates(feature)))
    .enter().append("path")
    .attr("class", "contourstd")
    .attr("d", d3.geoPath(d3.geoIdentity()))
    .attr("fill", d => mycolor(d.value));

  var size = 15

  svg.selectAll("mydots")
    .data(ticks2)
    .enter()
    .append("rect")
    .attr("x", width + size / 2)
    .attr("y", function (d, i) {
      return i * (size + 5)
    }) // 100 is where the first dot appears. 25 is the distance between dots
    .attr("width", size)
    .attr("height", size)
    .style("fill", d => mycolor(d))

  svg.selectAll("mylabels")
    .data(ticksLabels2)
    .enter()
    .append("text")
    .attr("x", width + size * 2)
    .attr("y", function (d, i) { return i * (size + 5) + (size / 2) }) // 100 is where the first dot appears. 25 is the distance between dots
    .style("fill", function (d, i) { return mycolor(ticks2[i]) })
    .text(function (d) { return d })
    .attr("text-anchor", "left")
    .attr("font-size", 10)
    .style("alignment-baseline", "middle")

  svg.append("text")
    .attr("transform", "translate(" + (width / 2) + " ," + (height + margin.bottom) + ")")
    .style("text-anchor", "middle")
    .attr("font-size", 14)
    .text("Distanza dalla fila");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (height / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .attr("font-size", 14)
    .text("Profondità");

  nextTick(() => {
    if (chartRef.value) {
      chartRef.value.replaceChildren(svg.node());
    }
  })
}

</script>

<template>
  <div ref="container">
    <svg v-if="showChart" :style="imageStyle" ref="chartRef"></svg>
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