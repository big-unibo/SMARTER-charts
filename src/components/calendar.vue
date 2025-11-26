<script setup lang="ts">
import { ref, shallowRef, markRaw, watchEffect, nextTick } from 'vue'
import { ScheduleXCalendar } from '@schedule-x/vue'
import {
  createCalendar,
  createViewMonthGrid
} from '@schedule-x/calendar'
import 'temporal-polyfill/global'
import '@schedule-x/theme-default/dist/index.css'
import { createEventModalPlugin } from '@schedule-x/event-modal'
import { CommunicationService } from "../services/CommunicationService.js";
import { luxonZoneDateTimeToStringCalendar } from '@/common/dateUtils.js'

const SCHEDULE_SAFE_PERIOD = 3600
const getEventsEndpoint = "calendar"
const updateEventEndpoint = "update"

const updateFailedMessage = ref(null)
const updateFailed = ref(false)

const props = defineProps(['config'])
const communicationService = new CommunicationService();

const calendarApp = shallowRef(null)
const selectedDate = ref(Temporal.Now.zonedDateTimeISO('Europe/Rome'))
const events = ref([])

const isEditing = ref(false)
const selectedEvent = ref(null);
const updateForm = ref({
  enabled: false,
  wateringStart: "",
  expectedWater: 0,
  note: ""
})
const updateModal = ref(null)

let eventsData = []
const eventModalPlugin = createEventModalPlugin()

const closeModal = () => {
  eventModalPlugin.close()
}


let activeModal
async function openEventModal(eventData) {
  selectedEvent.value = eventsData.filter(e => e.eventId === eventData.id)[0]
  updateForm.value = {
    enabled: selectedEvent.value.enabled,
    wateringStart: luxonZoneDateTimeToStringCalendar(selectedEvent.value.wateringStart),
    expectedWater: selectedEvent.value.expectedWater,
    note: selectedEvent.value.note
  }

  await nextTick()
  if (updateModal.value) {
    activeModal = new Modal(updateModal.value)
    updateFailed.value = false;
    updateFailedMessage.value = "";
    activeModal.show()
  } else {
    console.warn('Modal element not found')
  }
}

function isValidTime(time) {
  const newWateringStart = new Date(time).getTime() / 1000
  return newWateringStart > Date.now() / 1000 + SCHEDULE_SAFE_PERIOD
}

async function submitForm() {
  updateFailed.value = false;
  updateFailedMessage.value  = "";

  const wateringStart = new Date(updateForm.value.wateringStart).getTime() / 1000
  const updatedEvent = {
    wateringStart: wateringStart,
    enabled: updateForm.value.enabled,
    expectedWater: updateForm.value.expectedWater,
    note: updateForm.value.note
  }

  const eventId = selectedEvent.value.eventId

  const configParsed = JSON.parse(props.config);

  try {
    const saveStatus = await communicationService.updateEvent(configParsed.environment, eventId, updateEventEndpoint, updatedEvent)

    await mountChart()
    activeModal.hide()
  }

  catch (error) {
    if (error.status === 400) {
      updateFailedMessage.value = "Dati inseriti non validi.";
    } else {
      updateFailedMessage.value = "Errore durante il salvataggio, riprova più tardi..";
    }
    updateFailed.value = true;
  }
}


function unixToZonedDateTime(unixSeconds, timeZone = 'Europe/Rome') {
  return Temporal.Instant
    .fromEpochMilliseconds(Number(unixSeconds) * 1000)
    .toZonedDateTimeISO(timeZone)
}

function zonedDateTimeToUnixSeconds(zonedDateTime) {
  const epochMilliseconds = zonedDateTime.epochMilliseconds;
  return Math.floor(epochMilliseconds / 1000);
}

function isEventEditable(event) {
  if (!event || !event.start) return false;
  const eventTime = Number(event.start.epochMilliseconds);
  const now = Date.now();
  const safeBuffer = Number(SCHEDULE_SAFE_PERIOD) * 1000;

  return eventTime > (now + safeBuffer);
}

function titleFunction(event) {
  if (!event.enabled) {
    return "Irrigazione disabilitata"
  }
  if (event.advice === 0) {
    return "Irrigazione disabilitata (Consiglio di non irrigare)"
  }
  if (event.updatedBy !== null) {
    return "Irrigazione modificata"
  }
  if (event.wateringStart < Date.now() / 1000 && event.advice > 0) {
    return "Irrigazione inviata"
  }
  return "Irrigazione programmata"
}

function colorFunction(event) {
  if (!event.enabled || event.advice === 0) {
    return "disabled"
  }
  if (event.updatedBy !== null) {
    return "updated"
  }
  if (event.wateringStart < Date.now() / 1000 && event.advice > 0) {
    return "sent"
  }
  return "planned"
}

function formatEventDate(startStr, endStr) {
  const start = Temporal.ZonedDateTime.from(startStr)
  const end = Temporal.ZonedDateTime.from(endStr)

  const startDate = new Date(start.epochMilliseconds)
  const endDate = new Date(end.epochMilliseconds)

  const dateFormatter = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
  const timeFormatter = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' })

  const sameDay = start.toPlainDate().equals(end.toPlainDate())

  if (sameDay) {
    return `${dateFormatter.format(startDate)} ⋅ ${timeFormatter.format(startDate)} – ${timeFormatter.format(endDate)}`
  } else {
    return `${dateFormatter.format(startDate)} ${timeFormatter.format(startDate)} – ${dateFormatter.format(endDate)} ${dateFormatter.format(endDate)}`
  }
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '—'
  const ts = timestamp < 1e12 ? timestamp * 1000 : timestamp
  const date = new Date(ts)
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  }).format(date)
}

async function handleRangeUpdate(range) {
  const updatedTimeFiler = {
    timeFilterFrom: zonedDateTimeToUnixSeconds(range.start),
    timeFilterTo: zonedDateTimeToUnixSeconds(range.end)
  };

  await mountChart(
    updatedTimeFiler
  )
}


watchEffect(async () => {
  let value = props.config;
  if (value) {
    await mountChart()
  }
});

async function mountChart(timeFilter = null) {
  const configParsed = JSON.parse(props.config);

  const RANGE_OFFSET_SECONDS = 3024000; //35 Days

  if (!timeFilter) {
    let referenceTimestamp;
    const selectedTimeFilter = { ...configParsed.params };

    if (selectedTimeFilter.timeFilterTo) {
      referenceTimestamp = selectedTimeFilter.timeFilterTo;
      selectedDate.value = unixToZonedDateTime(referenceTimestamp);
    } else {
      const nowZoned = Temporal.Now.zonedDateTimeISO('Europe/Rome');
      selectedDate.value = nowZoned;
      referenceTimestamp = zonedDateTimeToUnixSeconds(nowZoned);
    }

    timeFilter = {
      timeFilterFrom: referenceTimestamp - RANGE_OFFSET_SECONDS,
      timeFilterTo: referenceTimestamp + RANGE_OFFSET_SECONDS
    };
  }

  const calendarResponse = await communicationService.getWateringSchedule(configParsed.environment, configParsed.paths, timeFilter, getEventsEndpoint)
  if (JSON.stringify(configParsed) !== props.config) {
    return
  }

  if (calendarResponse) {
    eventsData = calendarResponse.events
    const eventsCalendar = []
    for (const e of eventsData) {
      const startDate = unixToZonedDateTime(e.wateringStart)
      let endDate
      if (e.wateringEnd) {
        endDate = unixToZonedDateTime(e.wateringEnd)
      } else {
        endDate = startDate
      }

      const eventdata = {
        enabled: e.enabled, duration: e.duration, advice: e.advice, expectedWater: e.expectedWater, note: e.note, updatedBy: e.updatedBy, theses: e.theses
      }

      const event = {
        id: e.eventId, start: startDate, end: endDate, title: titleFunction(e), calendarId: colorFunction(e), isEditable: false, customData: eventdata
      }
      eventsCalendar.push(event)
    }
    events.value = eventsCalendar
  }
  await nextTick()
  if (!calendarApp.value) {
    calendarApp.value = markRaw(
      createCalendar({
        timezone: 'Europe/Rome',
        firstDayOfWeek: 1,
        selectedDate: selectedDate.value.toPlainDate(),
        locale: 'it-IT',
        views: [createViewMonthGrid()],
        calendars: {
          sent: { colorName: 'sent', lightColors: { main: '#fff', container: '#a3c2c2', onContainer: '#fff', }, },
          disabled: { colorName: 'disabled', lightColors: { main: 'fff', container: '#ff3336', onContainer: '#fff', }, },
          updated: { colorName: 'updated', lightColors: { main: '#fff', container: '#9966ff', onContainer: '#fff', }, },
          planned: { colorName: 'planned', lightColors: { main: '#fff', container: '#339CFF', onContainer: '#fff', }, },
        },
        plugins: [eventModalPlugin],
        callbacks: {
          onRangeUpdate: handleRangeUpdate
        },
        events: events.value,
      })
    )
  } else {
    calendarApp.value.events.set(events.value)
  }
}
</script>

<template>
  <div v-if="calendarApp">
    <ScheduleXCalendar :calendar-app="calendarApp">

      <template #eventModal="{ calendarEvent }">
        <div class="custom-event-modal" @vue:unmounted="isEditing = false">
          <button class="close-btn" @click="closeModal">×</button>

          <div class="event-title">
            {{ calendarEvent.title }}
          </div>

          <div class="event-time">
            {{ formatEventDate(calendarEvent.start, calendarEvent.end) }}
          </div>

          <div v-if="isEditing">

          </div>
          <div v-else>
            <div class="actions" v-if="isEventEditable(calendarEvent)">
              <button class="btn btn-primary update-event" @click.stop.prevent="openEventModal(calendarEvent)">
                Modifica evento
              </button>
            </div>

            <div class="event-updatedBy" v-if="calendarEvent.customData.updatedBy">
              <span class="label">Modificato da: </span>
              <span>{{ calendarEvent.customData.updatedBy }}</span>
            </div>

            <div class="event-data">
              <p>
                <span class="label">Stato: </span>
                <span>{{ calendarEvent.customData.enabled ? 'Abilitata' : 'Disabilitata' }}</span>
              </p>

              <p>
                <span class="label">Consiglio irriguo: </span>
                <span>{{ calendarEvent.customData.advice !== null ? calendarEvent.customData.advice + " L" :
                  "Non calcolato" }}</span>
              </p>

              <p>
                <span class="label">Durata: </span>
                <span>{{ calendarEvent.customData.duration !== null ? calendarEvent.customData.duration +
                  " minuti" : "Non calcolata" }}</span>
              </p>

              <p>
                <span class="label">Acqua extra sistema: </span>
                <span>{{ calendarEvent.customData.expectedWater ? calendarEvent.customData.expectedWater : 0
                }} L</span>
              </p>

              <p class="example">
                <em>Es. (fertirrigazione, pioggia prevista)</em>
              </p>

              <div v-if="calendarEvent.customData.theses && calendarEvent.customData.theses.length">
                <p><span class="label">Tesi Considerate:</span></p>
                <ul class="theses-list">
                  <li v-for="thesis in calendarEvent.customData.theses" :key="thesis.thesisId">
                    <div class="thesis-item">
                      <span class="thesis-name">{{ thesis.thesisName }}</span>
                      <span class="thesis-weight">{{ (thesis.weight * 100).toFixed(0) }}%</span>
                    </div>
                    <div class="thesis-timestamp">
                      <small>{{ formatTimestamp(thesis.imageTimestamp) }}</small>
                    </div>
                  </li>
                </ul>
              </div>

              <div v-if="calendarEvent.customData.note">
                <span class="label">Note: </span>
                <span>{{ calendarEvent.customData.note }}</span>
              </div>

            </div>
          </div>
        </div>
      </template>
    </ScheduleXCalendar>
    <div v-if="selectedEvent" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel"
      aria-hidden="true" ref="updateModal">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h1 class="modal-title fs-3"> Modifica Evento</h1>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <form @submit.prevent="submitForm">
            <div class="modal-body">
              <div v-if="updateFailed" class="alert alert-danger d-flex align-items-center" role="alert">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                  class="bi bi-exclamation-triangle-fill flex-shrink-0 me-2" viewBox="0 0 16 16">
                  <path
                    d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
                </svg>
                <div>{{ updateFailedMessage }}</div>
              </div>
              <div class="row text-center fs-5 p-2">
                <div class="col">{{ titleFunction(selectedEvent) }} - {{ new
                  Date(selectedEvent.date).toLocaleDateString("it-IT") }}</div>
              </div>
              <div class="form-group row align-items-center p-2 px-4">
                <div class="col-auto form-check form-switch">
                  <input type="checkbox" role="switch" class="form-check-input" id="enableEvent" name="enableEvent"
                    v-model="updateForm.enabled">
                </div>

                <div class="col-auto"><label class="form-check-label" for="enableEvent">Abilita evento</label></div>
              </div>
              <div class="form-group row align-items-center p-2">
                <div class="col-auto"><label for="startTime">Ora di Inizio:</label></div>
                <div class="col-auto">
                  <input type="datetime-local" class="form-control" id="startTime" name="startTime"
                    v-model="updateForm.wateringStart" :class="{ 'is-invalid': !isValidTime(updateForm.wateringStart) }"
                    required>
                  <span v-if="!isValidTime(updateForm.wateringStart)" class="text-danger">Ora di inizio non
                    valida</span>
                </div>

              </div>
              <div class="form-group row align-items-center p-2">
                <div class="col-auto"><label for="waterAmount">Acqua extra sistema (L):</label></div>
                <div class="col-auto"><input type="number" class="form-control" id="waterAmount" name="waterAmount"
                    min="0" step="0.01" v-model="updateForm.expectedWater"></div>
              </div>
              <div class="form-group row align-items-center p-2">
                <div><label for="note">Note:</label></div>
                <div class="my-2"><textarea class="form-control" id="note" name="note" rows="2"
                    v-model="updateForm.note"></textarea></div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>
              <button type="submit" class="btn btn-primary"
                :disabled="!isValidTime(updateForm.wateringStart)">Salva</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.actions {
  margin-top: 16px;
  text-align: left;
}

.update-event {
  opacity: 1 !important;
  visibility: visible !important;
  color: white !important;
  background-color: #0d6efd !important;
}

.update-event:hover {
  background-color: #0b5ed7 !important;
}


/* Modal styles */
.custom-event-modal {
  padding: 26px;
  background: #fff;
  color: black;
  border: 1px solid rgb(224 224 224);
  border-radius: 8px;
  box-shadow: 0 12px 24px #00000017, 0 6px 12px #0000002e;
  max-width: 420px;
  z-index: 999;
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #555;
  font-weight: bold;
  z-index: 1000;
}

.close-btn:hover {
  color: #000;
}

.event-title {
  font-weight: 500;
  font-size: 22px;
  margin-bottom: 0.4em;
}

.event-time,
.event-updatedBy {
  font-size: 14px;
  margin-bottom: 0.6em;
}

.event-data {
  padding: 12px;
}

.event-data p {
  margin: 0.4em 0;
  font-size: 16px;
}

.label {
  font-size: 16px;
  font-weight: 700;
  color: #222;
  min-width: 150px;
}

.event-data .example {
  margin-top: 0px;
  font-size: 12px;
  color: #555;
  font-style: italic;
}

.theses-list {
  list-style: none;
  padding-left: 0;
  margin: 0.4em 0;
  font-size: 14px;
}

.thesis-item {
  display: flex;
  justify-content: space-between;
  font-weight: 500;
  width: 70%;
}

.thesis-timestamp {
  color: #555;
  font-size: 13px;
  margin-bottom: 4px;
}
</style>

<!-- <script setup>
import { nextTick, ref, watchEffect, computed} from 'vue';
import {Qalendar} from 'qalendar';

import {CommunicationService} from "../services/CommunicationService.js";
import { luxonDateTimeToString, luxonDateTimeToStringCalendar } from "../common/dateUtils.js";
import { Modal } from 'bootstrap'

const updateModal = ref(null)

const SCHEDULE_SAFE_PERIOD = 3600000

const communicationService = new CommunicationService();
const props = defineProps(['config'])
const getEventsEndpoint = "calendar"
const updateEventEndpoint = "updateWateringEvent"

const events = ref([]);
const selectedDate = ref(new Date());
const calendarKey = computed(
  () => selectedDate.value.toISOString().slice(0,7) // "YYYY‑MM"
)
const selectedEvent = ref(null);
let eventsData = []

const config = ref({
  month: {
    showTrailingAndLeadingDates: true,
  },
  locale: 'it-IT',
  defaultMode: 'month',
  isSilent: true,
  disableModes: ['week','day'],
  style: {
    fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
    colorSchemes: {
      sent: {
        color: "#fff",
        backgroundColor: "#a3c2c2",
      },
      disabled: {
        color: "#fff",
        backgroundColor: "#ff3336",
      },
      updated:{
        color: "#fff",
        backgroundColor: "#9966ff",
      },
      planned:{
        color: "#fff",
        backgroundColor: "#339CFF",
      }
    },
  },
});

watchEffect(async () => {
  let value = props.config;
  if(value) {
    await mountChart()
  }
});

function colorFunction(event) {
  if(!event.enabled || event.advice === 0){
    return "disabled"
  }
  if(event.updatedBy !== null){
    return "updated"
  }
  if( event.wateringStart < Date.now()/1000 && event.advice > 0) {
      return "sent"
  }
  return "planned"
}

function titleFunction(event) {
  if(!event.enabled){
    return "Irrigazione disabilitata"
  }
  if (event.advice === 0){
    return "Irrigazione disabilitata (Consiglio di non irrigare)"
  }
  if(event.updatedBy !== null){
    return "Irrigazione modificata"
  }
  if( event.wateringStart < Date.now()/1000 && event.advice > 0) {
      return "Irrigazione inviata"
  }
  return "Irrigazione programmata"
}

async function mountChart(timeFilter) {
  const configParsed = JSON.parse(props.config);
  eventsData = []

  if(!timeFilter){
    timeFilter = {...configParsed.params}
    selectedDate.value = new Date(timeFilter.timeFilterTo * 1000);
    timeFilter.timeFilterTo = timeFilter.timeFilterTo + 604800 //one week
  }


  const calendarResponse = await communicationService.getWateringSchedule(configParsed.environment, configParsed.paths, timeFilter, getEventsEndpoint)
  if(JSON.stringify(configParsed) !== props.config){
      return
  }

  if(calendarResponse) {
    eventsData = calendarResponse.events
    const eventsCalendar = [] 
    for (const e of eventsData){
      const startDate = luxonDateTimeToStringCalendar(e.wateringStart)
      let endDate
      if(e.wateringEnd){
        endDate = luxonDateTimeToStringCalendar(e.wateringEnd)
      } else {
        endDate = startDate
      }

      const eventDescription = `<div><p><strong>Stato:</strong> ${e.enabled ? "Abilitata" : "Disabilitata"}</span></p>
      <p><strong>Tesi Considerata:</strong> ${e.thesisName}</span></p>
      ${ e.adviceTimestamp ? "<p><strong>Profilo di suolo considerato:</strong> " + luxonDateTimeToString(e.adviceTimestamp) + "</p>": ""}
      <p class="mb-0"><strong>Acqua extra sistema:</strong> ${e.expectedWater ? e.expectedWater : 0} L</p>
      <p class="form-text">Es.(fertirrigazione, pioggia prevista)</p>
      <p><strong>Consiglio irriguo:</strong> ${e.advice !== null ? e.advice + " L" : "Non calcolato"} </p>
      <p><strong>Durata:</strong> ${e.duration !== null ? e.duration + " minuti" : "Non calcolata"}</p>
      ${e.note ? ("<p><strong>Note:</strong> " + e.note + "</p>") : ""}
      ${ e.wateringStart * 1000 > Date.now() + SCHEDULE_SAFE_PERIOD ? "<button type=\"button\" class=\"btn btn-primary update-event\" id=" + e.date + ">Modifica</button>":""}</div>`

      const event = { 
        title: titleFunction(e),
        with: e.updatedBy !== null ? "Modificato da: " + e.updatedBy : null,
        time: { start: startDate, end: endDate},
        colorScheme: colorFunction(e),
        isEditable: false,
        id: e.date,
        description: eventDescription
      }
      eventsCalendar.push(event)
    }
    events.value = eventsCalendar
  }
}

function refreshPeriod(p){
  const startTimestamp = new Date(p.start).getTime()/1000
  const endTimestamp = new Date(p.end).getTime()/1000
  mountChart({timeFilterFrom: startTimestamp, timeFilterTo: endTimestamp})
}

let activeModal
async function openModal(eventDate) {
  const target=eventDate.target;
  if(Array.from(target.classList).filter(c=>c==="update-event").length>0){
    selectedEvent.value = eventsData.filter(e=>e.date===target.id)[0]
    updateForm.value = {
      enabled: selectedEvent.value.enabled,
      wateringStartTime: new Date(selectedEvent.value.wateringStart * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      expectedWater: selectedEvent.value.expectedWater,
      note: selectedEvent.value.note
    }
    await nextTick()
    if (updateModal.value) {
      activeModal = new Modal(updateModal.value)
      activeModal.show()
    } else {
      console.warn('Modal element not found')
    }
  }
}

const updateForm = ref({
  enabled: false,
  wateringStartTime: "",
  expectedWater: 0,
  note: ""
})

async function submitForm(){
  const wateringStart = new Date(selectedEvent.value.date +" "+ updateForm.value.wateringStartTime).getTime()/1000
  const updatedEvent = selectedEvent.value
  updatedEvent.enabled = updateForm.value.enabled
  updatedEvent.wateringStart = wateringStart
  const expectedWater = parseFloat(updateForm.value.expectedWater)
  if(!isNaN(expectedWater)){
    updatedEvent.expectedWater = expectedWater
  }
  updatedEvent.note = updateForm.value.note

  const parsed = JSON.parse(props.config);
  await communicationService.updateEvent(parsed.environment, updateEventEndpoint, parsed.paths, updatedEvent)
  await mountChart()
  activeModal.hide()
}

function isValidTime(time){
  const wateringStart = new Date(selectedEvent.value.date +" "+ time)
  return wateringStart > Date.now() + SCHEDULE_SAFE_PERIOD
}
</script>

<template>
  <div class="is-light-mode">
    <Qalendar
      :events="events"
      :config="config"
      :selectedDate="selectedDate"
      @updated-period="refreshPeriod" @edit-event="openModal" @click="openModal"
      :key="calendarKey"/>
    <div v-if="selectedEvent" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true" ref="updateModal">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h1 class="modal-title fs-3"> Modifica Evento</h1>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
            <form @submit.prevent="submitForm">
            <div class="modal-body">
              <div class="row text-center fs-5 p-2"> 
                <div class="col">{{titleFunction(selectedEvent)}} - {{ new Date(selectedEvent.date).toLocaleDateString("it-IT") }}</div>
              </div>
              <div class="form-group row align-items-center p-2 px-4">
                <div class="col-auto form-check form-switch">
                  <input type="checkbox" role="switch" class="form-check-input" id="enableEvent" name="enableEvent" v-model="updateForm.enabled">
                </div>
                <div class="col-auto"><label class="form-check-label" for="enableEvent">Abilita evento</label></div>
              </div>
              <div class="form-group row align-items-center p-2">
                <div class="col-auto"><label for="startTime">Ora di Inizio:</label></div>
                <div class="col-auto">
                  <input type="time" class="form-control" id="startTime" name="startTime" v-model="updateForm.wateringStartTime" :class="{ 'is-invalid': !isValidTime(updateForm.wateringStartTime) }" required>
                  <span v-if="!isValidTime(updateForm.wateringStartTime)" class="text-danger">Ora di inizio non valida</span>
                </div>
                
              </div>
              <div class="form-group row align-items-center p-2">
                <div class="col-auto"><label for="waterAmount">Acqua extra sistema (L):</label></div>
                <div class="col-auto"><input type="number" class="form-control" id="waterAmount" name="waterAmount" min="0" step="0.01" v-model="updateForm.expectedWater"></div>
              </div>
              <div class="form-group row align-items-center p-2">
                <div><label for="note">Note:</label></div>
                <div class="my-2"><textarea class="form-control" id="note" name="note" rows="2" v-model="updateForm.note"></textarea></div>
              </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>
                <button type="submit" class="btn btn-primary" :disabled="!isValidTime(updateForm.wateringStartTime)">Salva</button>
            </div>
          </form>
        </div>
      </div>  
    </div>
  </div>
</template>

<style>
  @import "@fortawesome/fontawesome-svg-core/styles.css";
  @import '../assets/main.css';
  @import 'qalendar/dist/style.css';

  .calendar-month__event .calendar-month__event-color{
    height: 20px !important;
    width: 20px !important;
  }

  .event-flyout {
    top: 40% !important;
  }

</style> -->