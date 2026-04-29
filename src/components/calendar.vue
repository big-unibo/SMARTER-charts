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
const communicationService = new CommunicationService()

const calendarApp = shallowRef(null)
const selectedDate = ref(Temporal.Now.zonedDateTimeISO('Europe/Rome'))
const events = ref([])

const isEditing = ref(false)
const selectedEvent = ref(null)

const isUpdateModalOpen = ref(false)

const updateForm = ref({
  enabled: false,
  wateringStart: "",
  expectedWater: 0,
  note: ""
})

let eventsData = []
const eventModalPlugin = createEventModalPlugin()

const closeUpdateModal = () => {
  isUpdateModalOpen.value = false
}

const closeDetailModal = () => {
  eventModalPlugin.close()
  closeUpdateModal()
}

async function openEventModal(eventData) {
  selectedEvent.value = eventsData.find(e => e.id === eventData.id)

  updateForm.value = {
    enabled: selectedEvent.value.enabled,
    wateringStart: luxonZoneDateTimeToStringCalendar(selectedEvent.value.wateringStart),
    expectedWater: selectedEvent.value.expectedWater,
    note: selectedEvent.value.note
  }

  updateFailed.value = false
  updateFailedMessage.value = ""

  await nextTick()
  isUpdateModalOpen.value = true
}

// -------------------------
function isValidTime(time) {
  const newWateringStart = new Date(time).getTime() / 1000
  return newWateringStart > Date.now() / 1000 + SCHEDULE_SAFE_PERIOD
}

// -------------------------
async function submitForm() {
  updateFailed.value = false
  updateFailedMessage.value = ""

  const wateringStart = new Date(updateForm.value.wateringStart).getTime() / 1000

  const updatedEvent = {
    wateringStart,
    enabled: updateForm.value.enabled,
    expectedWater: updateForm.value.expectedWater,
    note: updateForm.value.note
  }

  const eventId = selectedEvent.value.id

  try {
    const parsedConfig = JSON.parse(props.config)

    await communicationService.updateEvent(
      parsedConfig.environment,
      parsedConfig.paths.sectorId,
      eventId,
      updateEventEndpoint,
      updatedEvent
    )

    await mountChart()
    isUpdateModalOpen.value = false
  } catch (error) {
    if (error.status === 400) {
      updateFailedMessage.value = "Dati inseriti non validi."
    } else {
      updateFailedMessage.value = "Errore durante il salvataggio, riprova più tardi."
    }
    updateFailed.value = true
  }
}

// -------------------------
function unixToZonedDateTime(unixSeconds, timeZone = 'Europe/Rome') {
  return Temporal.Instant
    .fromEpochMilliseconds(Number(unixSeconds) * 1000)
    .toZonedDateTimeISO(timeZone)
}

function zonedDateTimeToUnixSeconds(zonedDateTime) {
  return Math.floor(zonedDateTime.epochMilliseconds / 1000)
}

function isEventEditable(event) {
  if (!event || !event.start) return false
  const eventTime = Number(event.start.epochMilliseconds)
  return eventTime > (Date.now() + SCHEDULE_SAFE_PERIOD * 1000)
}

// -------------------------
function titleFunction(event) {
  if (!event.enabled) return "Irrigazione disabilitata"
  if (event.advice === 0) return "Irrigazione disabilitata (Consiglio di non irrigare)"
  if (event.updatedBy !== null) return "Irrigazione modificata"
  if (event.scheduled) return "Irrigazione inviata"
  if (event.advice !== null) return "Irrigazione calcolata"
  return "Irrigazione programmata"
}

function colorFunction(event) {
  if (!event.enabled || event.advice === 0) return "disabled"
  if (event.updatedBy !== null) return "updated"
  if (event.scheduled) return "sent"
  if (event.advice !== null) return "computed"
  return "planned"
}

// -------------------------
function formatEventDate(startStr, endStr) {
  const start = Temporal.ZonedDateTime.from(startStr)
  const end = Temporal.ZonedDateTime.from(endStr)

  const startDate = new Date(start.epochMilliseconds)
  const endDate = new Date(end.epochMilliseconds)

  const dateFormatter = new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  const timeFormatter = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  })

  const sameDay = start.toPlainDate().equals(end.toPlainDate())

  if (sameDay) {
    return `${dateFormatter.format(startDate)} ⋅ ${timeFormatter.format(startDate)} – ${timeFormatter.format(endDate)}`
  }

  return `${dateFormatter.format(startDate)} ${timeFormatter.format(startDate)} – ${dateFormatter.format(endDate)} ${timeFormatter.format(endDate)}`
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '—'
  const ts = timestamp < 1e12 ? timestamp * 1000 : timestamp
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(ts))
}

// -------------------------
async function handleRangeUpdate(range) {
  await mountChart({
    timeFilterFrom: zonedDateTimeToUnixSeconds(range.start),
    timeFilterTo: zonedDateTimeToUnixSeconds(range.end)
  })
}

// -------------------------
watchEffect(async () => {
  if (props.config) await mountChart()
})

// -------------------------
async function mountChart(timeFilter = null) {
  const parsedConfig = JSON.parse(props.config)

  const RANGE_OFFSET_SECONDS = 3024000

  if (!timeFilter) {
    const now = Temporal.Now.zonedDateTimeISO('Europe/Rome')
    selectedDate.value = now

    const ref = parsedConfig.params?.timeFilterTo || zonedDateTimeToUnixSeconds(now)

    timeFilter = {
      timeFilterFrom: ref - RANGE_OFFSET_SECONDS,
      timeFilterTo: ref + RANGE_OFFSET_SECONDS
    }
  }

  const calendarResponse =
    await communicationService.getWateringSchedule(
      parsedConfig.environment,
      parsedConfig.paths,
      timeFilter,
      getEventsEndpoint
    )

  if (JSON.stringify(parsedConfig) !== props.config) return

  if (calendarResponse) {
    eventsData = calendarResponse.events

    events.value = eventsData.map(e => {
      const startDate = unixToZonedDateTime(e.wateringStart)
      const endDate = e.wateringEnd
        ? unixToZonedDateTime(e.wateringEnd)
        : startDate

      return {
        id: e.id,
        start: startDate,
        end: endDate,
        title: titleFunction(e),
        calendarId: colorFunction(e),
        isEditable: false,
        customData: {
          enabled: e.enabled,
          scheduled: e.scheduled,
          duration: e.duration,
          advice: e.advice,
          expectedWater: e.expectedWater,
          note: e.note,
          updatedBy: e.updatedBy,
          theses: e.theses
        }
      }
    })
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
          computed: { colorName: 'computed', lightColors: { container: '#7E9595' } },
          disabled: { colorName: 'disabled', lightColors: { container: '#ff3336' } },
          updated: { colorName: 'updated', lightColors: { container: '#9966ff' } },
          planned: { colorName: 'planned', lightColors: { container: '#339CFF' } },
          sent: { colorName: 'sent', lightColors: { container: '#34C16E' } }
        },
        plugins: [eventModalPlugin],
        callbacks: {
          onRangeUpdate: handleRangeUpdate
        },
        events: events.value
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
          <button class="smarter-btn-close" @click="closeDetailModal">×</button>

          <div class="smarter-calendar-event-title">
            {{ calendarEvent.title }}
          </div>

          <div class="smarter-calendar-event-time">
            {{ formatEventDate(calendarEvent.start, calendarEvent.end) }}
          </div>

          <div class="smarter-calendar-actions" v-if="isEventEditable(calendarEvent)">
            <button class="smarter-btn smarter-btn-primary smarter-calendar-update-event"
              @click.stop.prevent="openEventModal(calendarEvent)">
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
              <span>{{ calendarEvent.customData.advice !== null ? calendarEvent.customData.advice + " L" : "Non calcolato" }}</span>
            </p>

            <p>
              <span class="smarter-calendar-label">Durata: </span>
              <span>{{ calendarEvent.customData.duration !== null ? calendarEvent.customData.duration +
                " minuti" : "Non calcolata" }}</span>
            </p>

            <p>
              <span class="smarter-calendar-label">Acqua extra sistema: </span>
              <span>{{ calendarEvent.customData.expectedWater ?? 0 }} L</span>
            </p>
            <p class="smarter-calendar-example">
              <em>Es. (fertirrigazione, pioggia prevista)</em>
            </p>


            <div v-if="calendarEvent.customData.theses?.length">
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
      </template>
    </ScheduleXCalendar>

    <div v-if="isUpdateModalOpen" class="smarter-modal-backdrop" @click.self="closeUpdateModal" @click.stop>

      <div class="smarter-modal">

        <div class="modal-header">
          <h1 class="modal-title fs-3">Modifica Evento</h1>
          <button type="button" class="smarter-btn-close" @click="closeUpdateModal">×</button>
        </div>

        <form @submit.prevent="submitForm">

          <div class="modal-body">

            <div v-if="updateFailed" class="smarter-alert smarter-alert-danger">
              {{ updateFailedMessage }}
            </div>

            <div class="row text-center fs-5 p-2">
              <div class="col">
                {{ titleFunction(selectedEvent) }} -
                {{ new Date(selectedEvent?.date).toLocaleDateString("it-IT") }}
              </div>
            </div>
            <div class="smarter-form-group">
              <div class="smarter-switch-row">
                <label class="smarter-switch-label">Abilita evento</label>
                <label class="smarter-switch">
                  <input type="checkbox" v-model="updateForm.enabled" />
                  <span class="slider"></span>
                </label>
              </div>
            </div>
            <div class="smarter-form-row">
              <div class="smarter-form-group p-2">
                <label>Ora di Inizio</label>
                <input type="datetime-local" v-model="updateForm.wateringStart"
                  :class="{ 'is-invalid': !isValidTime(updateForm.wateringStart) }" />

                <span v-if="!isValidTime(updateForm.wateringStart)" class="text-danger">
                  Ora di inizio non valida
                </span>
              </div>

              <div class="smarter-form-group p-2">
                <label for="waterAmount">Acqua extra sistema (L)</label>
                <input type="number" id="waterAmount" v-model="updateForm.expectedWater" />
              </div>
            </div>

            <div class="smarter-form-group p-2">
              <label>Note</label>
              <textarea v-model="updateForm.note"></textarea>
            </div>

          </div>

          <div class="modal-footer">
            <button type="button" class="smarter-btn smarter-btn-secondary" @click="closeUpdateModal">
              Chiudi
            </button>

            <button type="submit" class="smarter-btn smarter-btn-primary" :disabled="!isValidTime(updateForm.wateringStart)">
              Salva
            </button>
          </div>

        </form>

      </div>
    </div>

  </div>
</template>

<style>
@import '../assets/calendar.css';
</style>