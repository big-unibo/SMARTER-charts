<script setup>
import { ref, shallowRef, markRaw, watchEffect, nextTick } from 'vue'
import { ScheduleXCalendar } from '@schedule-x/vue'
import {
  createCalendar,
  createViewMonthGrid
} from '@schedule-x/calendar'
import 'temporal-polyfill/global'
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

//Using the external bootstrap instance
const getBootstrap = () => {
  if (window.bootstrap) {
    return window.bootstrap;
  }
  
  console.error("Bootstrap JS not found.");
  return null;
}


const closeModal = () => {
  eventModalPlugin.close()
}


let activeModal = null;
async function openEventModal(eventData) {
  selectedEvent.value = eventsData.filter(e => e.id === eventData.id)[0]
  console.log("Selected event for update:", selectedEvent.value)
  updateForm.value = {
    enabled: selectedEvent.value.enabled,
    wateringStart: luxonZoneDateTimeToStringCalendar(selectedEvent.value.wateringStart),
    expectedWater: selectedEvent.value.expectedWater,
    note: selectedEvent.value.note
  }

  await nextTick()
  if (updateModal.value) {
    const bs = getBootstrap();
    
    if (bs) {
      activeModal = new bs.Modal(updateModal.value);
      updateFailed.value = false;
      updateFailedMessage.value = "";
      activeModal.show();
    }
  } else {
    console.warn('Modal element not found in DOM')
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

  try {
    const parsedConfig = JSON.parse(props.config)
    const saveStatus = await communicationService.updateEvent(parsedConfig.environment, eventId, updateEventEndpoint, updatedEvent)

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
  if(event.scheduled){
    return "Irrigazione inviata"
  }
  if (event.advice !== null) {
    return "Irrigazione calcolata"
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
  if(event.scheduled){
    return "sent"
  }
  if (event.advice !== null) {
    return "computed"
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
  const parsedConfig = JSON.parse(props.config);

  const RANGE_OFFSET_SECONDS = 3024000; //35 Days

  if (!timeFilter) {
    let referenceTimestamp;
    const selectedTimeFilterTo = parsedConfig.params?.timeFilterTo;

    if (selectedTimeFilterTo) {
      referenceTimestamp = selectedTimeFilterTo
      selectedDate.value = unixToZonedDateTime(selectedTimeFilterTo);
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

  const calendarResponse = await communicationService.getWateringSchedule(parsedConfig.environment, parsedConfig.paths, timeFilter, getEventsEndpoint)
  if (JSON.stringify(parsedConfig) !== props.config) {
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
        enabled: e.enabled, scheduled: e.scheduled, duration: e.duration, advice: e.advice, expectedWater: e.expectedWater, note: e.note, updatedBy: e.updatedBy, theses: e.theses
      }

      const event = {
        id: e.id, start: startDate, end: endDate, title: titleFunction(e), calendarId: colorFunction(e), isEditable: false, customData: eventdata
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
          computed: { colorName: 'computed', lightColors: { main: '#fff', container: '#7E9595', onContainer: '#fff', }, },
          disabled: { colorName: 'disabled', lightColors: { main: 'fff', container: '#ff3336', onContainer: '#fff', }, },
          updated: { colorName: 'updated', lightColors: { main: '#fff', container: '#9966ff', onContainer: '#fff', }, },
          planned: { colorName: 'planned', lightColors: { main: '#fff', container: '#339CFF', onContainer: '#fff', }, },
          sent: { colorName: 'sent', lightColors: { main: '#fff', container: '#34C16E', onContainer: '#fff', }, },
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
        <div class="smarter-calendar-event-modal" @vue:unmounted="isEditing = false">
          <button class="smarter-calendar-close-btn" @click="closeModal">×</button>

          <div class="smarter-calendar-event-title">
            {{ calendarEvent.title }}
          </div>

          <div class="smarter-calendar-event-time">
            {{ formatEventDate(calendarEvent.start, calendarEvent.end) }}
          </div>

          <div v-if="isEditing">

          </div>
          <div v-else>
            <div class="smarter-calendar-actions" v-if="isEventEditable(calendarEvent)">
              <button class="btn btn-primary smarter-calendar-update-event" @click.stop.prevent="openEventModal(calendarEvent)">
                Modifica evento
              </button>
            </div>

            <div class="smarter-calendar-event-updatedBy" v-if="calendarEvent.customData.updatedBy">
              <span class="smarter-calendar-label">Modificato da: </span>
              <span>{{ calendarEvent.customData.updatedBy }}</span>
            </div>

            <div class="smarter-calendar-event-data">
              <p>
                <span class="smarter-calendar-label">Stato: </span>
                <span>{{ calendarEvent.customData.enabled ? 'Abilitata' : 'Disabilitata' }}</span>
              </p>

              <p>
                <span class="smarter-calendar-label">Programmazione: </span>
                <span>{{ calendarEvent.customData.scheduled ? 'Inviata' : 'Non inviata' }}</span>
              </p>

              <p>
                <span class="smarter-calendar-label">Consiglio irriguo: </span>
                <span>{{ calendarEvent.customData.advice !== null ? calendarEvent.customData.advice + " L" :
                  "Non calcolato" }}</span>
              </p>

              <p>
                <span class="smarter-calendar-label">Durata: </span>
                <span>{{ calendarEvent.customData.duration !== null ? calendarEvent.customData.duration +
                  " minuti" : "Non calcolata" }}</span>
              </p>

              <p>
                <span class="smarter-calendar-label">Acqua extra sistema: </span>
                <span>{{ calendarEvent.customData.expectedWater ? calendarEvent.customData.expectedWater : 0
                }} L</span>
              </p>

              <p class="smarter-calendar-example">
                <em>Es. (fertirrigazione, pioggia prevista)</em>
              </p>

              <div v-if="calendarEvent.customData.theses && calendarEvent.customData.theses.length">
                <p><span class="smarter-calendar-label">Tesi Considerate:</span></p>
                <ul class="smarter-calendar-theses-list">
                  <li v-for="thesis in calendarEvent.customData.theses" :key="thesis.thesisId">
                    <div class="smarter-calendar-thesis-item">
                      <span class="thesis-name">{{ thesis.thesisName }}</span>
                      <span class="thesis-weight">{{ (thesis.weight * 100).toFixed(0) }}%</span>
                    </div>
                    <div class="smarter-calendar-thesis-timestamp">
                      <small>{{ formatTimestamp(thesis.imageTimestamp) }}</small>
                    </div>
                  </li>
                </ul>
              </div>

              <div v-if="calendarEvent.customData.note">
                <span class="smarter-calendar-label">Note: </span>
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

<style>
@import '../assets/calendar.css';
</style>