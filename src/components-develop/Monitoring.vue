<script setup>

import '@/assets/basebase.css';
import authService from '@/services-develop/auth.service.js';
import { computed, watch, onMounted, reactive, ref, watchEffect } from "vue";

const props = defineProps(['token', 'user'])

let selectedTimestampFrom = ref(getCurrentTimestampMinusDays(7))
let selectedTimestampTo = ref(getCurrentTimestampMinusDays(0))

let customSelectedTimestampTo = ref(getCurrentTimestampMinusDays(0))
let customSelectedTimestampFrom = ref(getCurrentTimestampMinusDays(2))


let selectedFieldName = ref("Seleziona un campo")
let selectedThesisName = ref("Seleziona una tesi")
let selectedThesis = ref({thesisId: 311})
let selectedTimeLabel = ref("")
let showDynamicHeatmap = ref(false)
let showOptimalMatrix = ref(false)
let showDetailedWatering = ref(false)
let detailedWateringButton = ref("Mostra puntuale")

const baseConnectionParams = ref("{}")

const token = computed(() => props.token);
watch(token, () => {
  updateConnectionParams();
});

//const user = reactive(props.user)
const userPermissions = reactive({})

const fields = reactive([])
const thesis = reactive([])
let activeThesis

// watchEffect(async () => {
// 	if (token.value) {
// 		if (!selectedThesis.value && fields.value[0]) {
// 			selectField(fields.value[0])
// 		}
// 	}
// })


function updateConnectionParams() {
  if (selectedThesis.value) {
    const params = {
      environment: {
        host: import.meta.env.VITE_BACKEND_ADDRESS,
        token: token.value,
      },
      paths: selectedThesis.value,
      params: {
        timeFilterFrom: selectedTimestampFrom.value,
        timeFilterTo: selectedTimestampTo.value,
      },
    }
    baseConnectionParams.value = JSON.stringify(params)
  }
}
updateConnectionParams()

const selectedDateFrom = computed({
	get: () => {
		const timestamp = customSelectedTimestampFrom.value * 1000;
		return new Date(timestamp).toISOString().slice(0, 10);
	},
	set: (newValue) => {
		if (Date.parse(newValue)) {
			customSelectedTimestampFrom.value = Date.parse(newValue) / 1000;
		}
	}
});

const selectedDateTo = computed({
	get: () => {
		const timestamp = customSelectedTimestampTo.value * 1000;
		return new Date(timestamp).toISOString().slice(0, 10);
	},
	set: (newValue) => {
		if (Date.parse(newValue)) {
			customSelectedTimestampTo.value = Date.parse(newValue) / 1000;
		}
	}
});

function getCurrentTimestampMinusDays(days) {
	let currentDate = new Date();
	currentDate.setDate(currentDate.getDate() - days);
	return Math.floor(currentDate.getTime() / 1000);
}


function updateCustomTimestamps() {
	selectedTimestampFrom.value = customSelectedTimestampFrom.value
	selectedTimestampTo.value = customSelectedTimestampTo.value
	updateConnectionParams()
}

function selectItem(item) {
	selectedThesisName = createThesisName(item)
	selectedThesis.value = item
	updateConnectionParams()
}

function selectField(field) {
	selectedFieldName.value = createFieldName(field)
	thesis.value = activeThesis.get(JSON.stringify(field))
	selectedThesis.value = thesis.value[0]
	selectItem(selectedThesis.value)
}

function createFieldName(item) {
	if (!item) return ''
	return `${item.refStructureName}; ${item.companyName}; ${item.fieldName}`
}

function createThesisName(item) {
	if (!item) return ''
	return `Settore ${item.sectorName}; Tesi ${item.thesisName}; ${item.colture}; ${item.coltureType}`
}

async function updateUserPermission() {
	if (token.value) {
		userPermissions.value = await authService.retrieveUserFieldPermissions(token.value, selectedTimestampFrom.value, selectedTimestampTo.value)
		activeThesis = userPermissions.value.permissions.reduce((accumulator, currentValue) => {
			const field = JSON.stringify({
				refStructureName: currentValue.refStructureName,
				companyName: currentValue.companyName,
				fieldName: currentValue.fieldName
			})
			if (!accumulator.has(field)) {
				accumulator.set(field, [])
			}
			accumulator.get(field).push(currentValue)
			return accumulator
		}, new Map())

		fields.value = Array(...activeThesis.keys()).map(f => JSON.parse(f))
	}
}

function hasUserPermission(permission) {
	if (userPermissions && userPermissions.value && userPermissions.value.permissions) {
		if (!selectedThesis.value || Object.keys(selectedThesis.value).length === 0) return false;
		if (userPermissions.value.role === 'admin') return true
		const keySelected = createFieldName(selectedThesis.value) + createThesisName(selectedThesis.value)
		for (const field of userPermissions.value.permissions) {
			const tmpKey = createFieldName(field) + createThesisName(field)
			if (keySelected === tmpKey) {
				return field.permissions.includes(permission)
			}
		}
	}
	return false
}

function enableDynamicHeatmap() {
	showDynamicHeatmap.value = !showDynamicHeatmap.value
}

function enableOptimalMatrix() {
	showOptimalMatrix.value = !showOptimalMatrix.value
}

function enableDetailedAggregate() {
	showDetailedWatering.value = !showDetailedWatering.value
	detailedWateringButton.value = showDetailedWatering.value ? "Mostra giornaliero" : "Mostra puntuale"
}

const selectedTimestamp = ref(Math.floor(Date.now() / 1000))
function selectedTime(time) {
	selectedTimestamp.value = time.detail
}

</script>
<template>
	<div class="container align-top mt-5 pt-5 pt-sm-3">
		<div class="row m-2" id="timeperiod">
			<div class="col d-flex justify-content-center">
				<span class="m-1">Filtra periodo da:</span>
				<input type="date" name="timeperiod_from" v-model="selectedDateFrom">
				<span class="m-1"> a:</span>
				<input type="date" name="timeperiod_to" v-model="selectedDateTo">
				<div class="btn-group-toggle" data-toggle="buttons">
					<label class="btn btn-sm btn-secondary" style="margin-left:10px;">
						<input type="radio" name="timefilter" value="timefilter_customizesearch_day"
							@click="updateCustomTimestamps" autocomplete="off"> Cerca
					</label>
				</div>
			</div>
		</div>
		<div class="m-2 col-md-12 d-flex flex-row justify-content-center flex-wrap">
			<div v-if="fields.value" class="d-flex align-items-center flex-wrap">
				<p class="px-2 m-0">Campo:</p>
				<button class="btn btn-secondary dropdown-toggle my-1 px-2" type="button" id="dropdownMenuButton"
					data-bs-toggle="dropdown" aria-expanded="false">
					{{ selectedFieldName }}
				</button>
				<ul class="dropdown-menu" aria-labelledby="dropdownMenuButton">
					<li v-for="(item, index) in fields.value" :key="index">
						<a class="dropdown-item" href="#" @click.prevent="selectField(item)">
							{{ createFieldName(item) }}
						</a>
					</li>
				</ul>
			</div>
			<div v-if="thesis.value" class="d-flex align-items-center flex-wrap">
				<p class="px-2 mb-0">Tesi: </p>
				<button class="btn btn-secondary dropdown-toggle my-1 px-2" type="button" id="dropdownMenuButton"
					data-bs-toggle="dropdown" aria-expanded="false">
					{{ selectedThesisName }}
				</button>
				<ul class="dropdown-menu" aria-labelledby="dropdownMenuButton">
					<li v-for="(item, index) in thesis.value" :key="index">
						<a class="dropdown-item" href="#" @click.prevent="selectItem(item)">
							{{ createThesisName(item) }}
						</a>
					</li>
				</ul>
			</div>
		</div>

		<div v-if="true" class="my-3 container col-md-12">
			<div class="humidity-card card">
				<div class="card-header d-flex justify-content-between align-items-center">
					<span>Matrice dell'umidità</span>
					<!-- <div>
						<WateringAdviceSimulatorComponent v-if="true"
							:config="JSON.stringify(connectionParams)" :selectedTimestamp="selectedTimestamp" />
						<UpdateOptimalStateComponent v-if="true"
							:config="JSON.stringify(connectionParams)" :selectedTimestamp="selectedTimestamp" />
						<button class="btn btn-sm btn-secondary m-1" type="button" @click="enableOptimalMatrix"
							id="optimal-heatmap-button">Mostra ottimo</button>
						<button class="btn btn-sm btn-secondary m-1" type="button" @click="enableDynamicHeatmap"
							id="dynamic-heatmap-button">Mostra evoluzione</button>
					</div> -->
				</div>
				<div class="card-body">
					<div class="row">
						<span>Seleziona un istante temporale nel grafico di sinistra per mostrare la relativa matrice di
							umidità (Con "<strong>G</strong>"
							si denota la posizione del gocciolatore):</span>
						<div class="col-lg-6 align-content-center">
							<humiditymultiline-chart-smarter :config="baseConnectionParams"
								@selectTimestamp="selectedTime"></humiditymultiline-chart-smarter>
						</div>
						<!-- <div class="col-lg-6">
							<humiditymap-smarter :config="JSON.stringify(connectionParams)"
								:selectedTimestamp="selectedTimestamp"></humiditymap-smarter>
						</div> -->
					</div>
					<!-- <optimal-humidity-heatmap-smarter v-if="showOptimalMatrix"
						:config="JSON.stringify(connectionParams)" :selectedTimestamp="selectedTimestamp"
						:showDistance="hasUserPermission('*')"></optimal-humidity-heatmap-smarter> -->
				</div>
			</div>
		</div>

		<div v-if="showDynamicHeatmap" class="my-3 container col-md-12">
			<div class="dynamicheatmap-card card">
				<div class="card-header d-flex justify-content-between align-items-center">
					<span>Evoluzione matrice dell'umidità</span>
				</div>
				<div class="card-body">
					<heatmap-animation-smarter v-if="hasUserPermission('MO')"
						:config="JSON.stringify(connectionParams)"></heatmap-animation-smarter>
				</div>
			</div>
		</div>

		<!-- <div v-if="hasUserPermission('MO')" class="my-3 container col-md-12">
			<div class="groundwaterpot-card card">
				<div class="card-header">Potenziale idrico</div>
				<div class="card-body">
					<groundwaterpot-chart-smarter style="height: 320px" :config="JSON.stringify(connectionParams)"></groundwaterpot-chart-smarter>
				</div>
			</div>
		</div>	 -->
		<div v-if="true" class="my-3 container col-md-12">
			<div class="groundwaterpot-card card">
				<div class="card-header">Potenziale idrico</div>
				<div class="card-body">
					<groundwaterpot-chart-smarter
						style="height: 320px"
						:config="baseConnectionParams"
						:extraParams="JSON.stringify({
							signalTypes: ['SOIL_WATER_CONTENT', 'SOIL_WATER_POTENTIAL'],
					
							aggregationType: 'AVG'
						})"
					/>
				</div>
			</div>
		</div>

		<div v-if="hasUserPermission('WA')" class="my-3 container col-md-12">
			<div class="card">
				<div class="card-header d-flex justify-content-between align-items-center">
					<span>Calendario Irrigazione</span>
				</div>
				<div class="card-body p-1">
					<calendar-smarter :config="JSON.stringify(connectionParams)"></calendar-smarter>
				</div>
			</div>
		</div>

		<div v-if="hasUserPermission('MO')" class="my-3 container col-md-12">
			<div class="card">
				<div class="card-header d-flex justify-content-between align-items-center">
					<span>Consiglio Irriguo, Irrigazione e Precipitazioni</span>
					<button class="btn btn-sm btn-secondary" type="button" @click="enableDetailedAggregate"
						id="dynamic-heatmap-button">{{ detailedWateringButton }}</button>
				</div>
				<div v-if="!showDetailedWatering">
					<water-aggregate-chart-smarter
						:config="JSON.stringify(connectionParams)"></water-aggregate-chart-smarter>
				</div>
				<div v-else>
					<dripperandpluv-chart-smarter
						:config="JSON.stringify(connectionParams)"></dripperandpluv-chart-smarter>
				</div>
			</div>
		</div>

		<div v-if="hasUserPermission('WA')" class="my-3 container col-md-12">
			<div class=" card">
				<div class="card-header">Potenziale Idrico Ottimale e Potenziale Idrico Medio Giornaliero</div>
				<div class="card-body">
					<delta-chart-smarter style="height: 300px"
						:config="JSON.stringify(connectionParams)"></delta-chart-smarter>
				</div>
			</div>
		</div>

		<div v-if="hasUserPermission('MO')" class="my-3 container">
			<div class="countors-card card">
				<div class="card-header">Matrici di media e varianza</div>
				<div class="card-body row">
					<div class="col-lg-6">
						<p>Matrice dell'umidità <strong>media</strong> lungo il periodo:</p>
						<meancountor-chart-smarter
							:config="JSON.stringify(connectionParams)"></meancountor-chart-smarter>
					</div>
					<div class="col-lg-6">
						<p>Matrice di <strong>varianza</strong> dell'umidità lungo il periodo:</p>
						<stdcountor-chart-smarter :config="JSON.stringify(connectionParams)"></stdcountor-chart-smarter>
					</div>
				</div>
			</div>
		</div>

		<div v-if="hasUserPermission('MO')" class="my-3 container col-md-12">
			<div class="card">
				<div class="card-header">Temperatura dell'aria</div>
				<div class="card-body">
					<airtemperature-chart-smarter style="height: 300px"
						:config="JSON.stringify(connectionParams)"></airtemperature-chart-smarter>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
input[type=radio] {
	position: absolute;
	clip: rect(0, 0, 0, 0);
	pointer-events: none;
}

.timefilter {
	margin-right: 10px;
}
</style>