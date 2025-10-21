<script setup>

import '@/assets/basebase.css';
//import LogComponent from './LogComponent.vue';
//import UpdateOptimalStateComponent from './UpdateOptimalStateComponent.vue';
//import {useRouter} from "vue-router";
import authService from '@/services-develop/auth.service.js';
//import WateringAdviceSimulatorComponent from './WateringAdviceSimulatorComponent.vue';
import {computed, onMounted, reactive, ref, watchEffect} from "vue";

const props = defineProps(['token'])

let showCustomizeInput = ref(false)

let selectedTimestampFrom = ref(getCurrentTimestampMinusDays(7))
let selectedTimestampTo = ref(getCurrentTimestampMinusDays(0))

let customSelectedTimestampTo = ref(getCurrentTimestampMinusDays(0))
let customSelectedTimestampFrom = ref(getCurrentTimestampMinusDays(2))


let selectedFieldName = ref("Seleziona un campo")
let selectedThesisName = ref("Seleziona una tesi")
let selectedThesis = ref(null)
let selectedTimeLabel = ref("")
let showDynamicHeatmap = ref(false)
let showOptimalMatrix = ref(false)
let showDetailedWatering = ref(false)
let detailedWateringButton = ref("Mostra puntuale")

const token = reactive(props.token)
const user = reactive(props.user)
const userPermissions = reactive({})

const fields = reactive([])
const thesis = reactive([])
let activeThesis
let connectionParams = {}


watchEffect(async ()=>{
  if(token.value){
    await updateUserPermission()
    if (!selectedThesis.value && fields.value[0]){
      selectField(fields.value[0])
    }
  }
})


function updateConnectionParams() {
  if(selectedThesis.value){
    connectionParams = {
    environment: {
      host: import.meta.env.VITE_BACKEND_ADDRESS,
      token: token.value 
    },
    paths: selectedThesis.value,
    params: {
      timeFilterFrom: selectedTimestampFrom.value,
      timeFilterTo: selectedTimestampTo.value
    }
  }
  }
}

const selectedDateFrom = computed({
  get: () => {
    const timestamp = customSelectedTimestampFrom.value * 1000;
    return new Date(timestamp).toISOString().slice(0, 10);
  },
  set: (newValue) => {
    if(Date.parse(newValue)){
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
    if(Date.parse(newValue)){
      customSelectedTimestampTo.value = Date.parse(newValue) / 1000;
    }
  }
});

function selectTimePeriod(timeFilter) {

  switch (timeFilter) {
    case 'customize_day':
      showCustomizeInput.value = true;
      selectedTimeLabel.value = 'customize_day';
      break;
    case '30_day':
      showCustomizeInput.value = false;
      selectedTimestampFrom.value = getCurrentTimestampMinusDays(30);
      selectedTimestampTo.value = getCurrentTimestampMinusHours(0)
      selectedTimeLabel.value = '30_day';
      break;
    case '7_day':
      showCustomizeInput.value = false;
      selectedTimestampFrom.value = getCurrentTimestampMinusDays(7);
      selectedTimestampTo.value = getCurrentTimestampMinusHours(0)
      selectedTimeLabel.value = '7_day';
      break;
    case '24_hours':
      showCustomizeInput.value = false;
      selectedTimestampFrom.value = getCurrentTimestampMinusHours(24);
      selectedTimestampTo.value = getCurrentTimestampMinusHours(0)
      selectedTimeLabel.value = '24_hours';
      break;
  }

  if(timeFilter != 'customize_day'){
    updateUserPermission()
    updateConnectionParams()
  }
}

function getCurrentTimestampMinusDays(days) {
  let currentDate = new Date();
  currentDate.setDate(currentDate.getDate() - days);
  return Math.floor(currentDate.getTime() / 1000);
}

function getCurrentTimestampMinusHours(hours) {
  let currentDate = new Date();
  currentDate.setHours(currentDate.getHours() - hours);
  return Math.floor(currentDate.getTime() / 1000);
}

function updateCustomTimestamps(){
  selectedTimestampFrom.value = customSelectedTimestampFrom.value
  selectedTimestampTo.value = customSelectedTimestampTo.value
  updateUserPermission()
  updateConnectionParams()
}

function selectItem(item) {
  selectedThesisName = createThesisName(item)
  selectedThesis.value = item
  updateConnectionParams()
}

function selectField(field){
  selectedFieldName.value = createFieldName(field)
  thesis.value = activeThesis.get(JSON.stringify(field))
  selectedThesis.value = thesis.value[0]
  selectItem(selectedThesis.value)
}

function createFieldName(item) {
  if(!item) return ''
  return `${item.refStructureName}; ${item.companyName}; ${item.fieldName}`
}

function createThesisName(item){
  if(!item) return ''
  return `Settore ${item.sectorName}; Tesi ${item.thesisName}; ${item.colture}; ${item.coltureType}`
}

function isLabelSelected(value) {
  return selectedTimeLabel.value === value
}

async function updateUserPermission(){
  if (token.value){
    userPermissions.value = await authService.retrieveUserFieldPermissions(token.value, selectedTimestampFrom.value, selectedTimestampTo.value)
    activeThesis = userPermissions.value.permissions.reduce((accumulator, currentValue)=>{
      const field = JSON.stringify({
        refStructureName: currentValue.refStructureName,
        companyName: currentValue.companyName,
        fieldName: currentValue.fieldName
      })
      if (!accumulator.has(field)){
        accumulator.set(field,[])
      }
      accumulator.get(field).push(currentValue)
      return accumulator
    }, new Map())
    
    fields.value = Array(...activeThesis.keys()).map(f => JSON.parse(f))
  }
}

function hasUserPermission(permission) {
  if(userPermissions && userPermissions.value && userPermissions.value.permissions) {
    if(!selectedThesis.value || Object.keys(selectedThesis.value).length === 0) return false;
    if(userPermissions.value.role === 'admin') return true
    const keySelected = createFieldName(selectedThesis.value)+ createThesisName(selectedThesis.value)
    for(const field of userPermissions.value.permissions) {
      const tmpKey = createFieldName(field)+ createThesisName(field)
      if(keySelected === tmpKey) {
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

const selectedTimestamp = ref(Math.floor(Date.now()/1000))
function selectedTime(time){
  selectedTimestamp.value = time.detail
}

</script>

<template>

	<div class="container align-top mt-5 pt-5 pt-sm-3">
		<div class="row m-2">
			<div class="col d-flex justify-content-center">
				<div class="btn-group-toggle text-center" data-toggle="buttons">
					<span class="m-2">Filtro:</span>
					<label :class="{ active: isLabelSelected('customize_day') }" class="btn btn-sm btn-secondary timefilter m-1">
						<input type="radio" name="timefilter-radio" value="customize_day" autocomplete="off" @click="selectTimePeriod('customize_day')">Altro periodo
					</label>
					<label class="btn btn-sm btn-secondary timefilter m-1" :class="{active: isLabelSelected('30_day')}">
						<input type="radio" name="timefilter-radio" value="30_day" autocomplete="off" @click="selectTimePeriod('30_day')">Ultimo mese
					</label>
					<label class="btn btn-sm btn-secondary timefilter m-1" :class="{active: isLabelSelected('7_day')}">
						<input type="radio" id="one_week_filter" name="timefilter-radio" value="7_day" autocomplete="off" @click="selectTimePeriod('7_day')" checked>Ultima settimana
					</label>
					<label class="btn btn-sm btn-secondary timefilter m-1" :class="{active: isLabelSelected('24_hours')}">
						<input type="radio" name="timefilter-radio" value="24_hour" @click="selectTimePeriod('24_hours')" autocomplete="off">Ultime 24h
					</label>
				</div>
			</div>
		</div>	
	</div>
</template>

<style scoped>

  input[type=radio] {
    position: absolute;
    clip: rect(0,0,0,0);
    pointer-events: none;
  }

  .timefilter{
    margin-right: 10px;
  }

</style>