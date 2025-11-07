<script setup>
import { ref, shallowRef, onMounted, markRaw, watchEffect, nextTick } from 'vue'
import { ScheduleXCalendar } from '@schedule-x/vue'
import {
    createCalendar,
    createViewMonthGrid,
    createViewWeek,
    createViewDay,
    createViewMonthAgenda,
} from '@schedule-x/calendar'
import 'temporal-polyfill/global'
import '@schedule-x/theme-default/dist/index.css'

import { CommunicationService } from "../services/CommunicationService.js";

const getEventsEndpoint = "calendar"

const props = defineProps(['config'])
const communicationService = new CommunicationService();

const calendarApp = shallowRef(null)
const selectedDate = ref(Temporal.Now.zonedDateTimeISO('Europe/Rome'))
const events = ref([])

let eventsData = []


function unixToZonedDateTime(unixSeconds, timeZone = 'Europe/Rome') {
    return Temporal.Instant
        .fromEpochMilliseconds(Number(unixSeconds) * 1000)
        .toZonedDateTimeISO(timeZone)
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



watchEffect(async () => {
    let value = props.config;
    if (value) {
        await mountChart()
    }
});

async function mountChart(timeFilter) {
    const configParsed = JSON.parse(props.config);

    if (!timeFilter) {
        timeFilter = { ...configParsed.params }
        if (timeFilter.timeFilterTo) {
            selectedDate.value = unixToZonedDateTime(timeFilter.timeFilterTo)
        } else {
            selectedDate.value = Temporal.Now.zonedDateTimeISO('Europe/Rome')
        }
    }

    const calendarResponse = await communicationService.getWateringSchedule(configParsed.environment, configParsed.paths, timeFilter, getEventsEndpoint)
    if (JSON.stringify(configParsed) !== props.config) {
        return
    }

    console.log(calendarResponse)
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

            //         const eventDescription = `<div><p><strong>Stato:</strong> ${e.enabled ? "Abilitata" : "Disabilitata"}</span></p>
            //   <p><strong>Tesi Considerata:</strong> ${e.thesisName}</span></p>
            //   ${e.adviceTimestamp ? "<p><strong>Profilo di suolo considerato:</strong> " + luxonDateTimeToString(e.adviceTimestamp) + "</p>" : ""}
            //   <p class="mb-0"><strong>Acqua extra sistema:</strong> ${e.expectedWater ? e.expectedWater : 0} L</p>
            //   <p class="form-text">Es.(fertirrigazione, pioggia prevista)</p>
            //   <p><strong>Consiglio irriguo:</strong> ${e.advice !== null ? e.advice + " L" : "Non calcolato"} </p>
            //   <p><strong>Durata:</strong> ${e.duration !== null ? e.duration + " minuti" : "Non calcolata"}</p>
            //   ${e.note ? ("<p><strong>Note:</strong> " + e.note + "</p>") : ""}
            //   ${e.wateringStart * 1000 > Date.now() + SCHEDULE_SAFE_PERIOD ? "<button type=\"button\" class=\"btn btn-primary update-event\" id=" + e.date + ">Modifica</button>" : ""}</div>`

            const event = {
                id: e.date,
                start: startDate,
                end: endDate,
                title: titleFunction(e),
                with: e.updatedBy !== null ? "Modificato da: " + e.updatedBy : null,
                calendarId: colorFunction(e),
                isEditable: false,
                //description: eventDescription
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
                    sent: {
                        colorName: 'sent',
                        lightColors: {
                            main: '#fff',
                            container: '#a3c2c2',
                            onContainer: '#fff',
                        },
                    },
                    disabled: {
                        colorName: 'disabled',
                        lightColors: {
                            main: 'fff',
                            container: '#ff3336',
                            onContainer: '#fff',
                        },
                    },
                    updated: {
                        colorName: 'updated',
                        lightColors: {
                            main: '#fff',
                            container: '#9966ff',
                            onContainer: '#fff',
                        },
                    },
                    planned: {
                        colorName: 'planned',
                        lightColors: {
                            main: '#fff',
                            container: '#339CFF',
                            onContainer: '#fff',
                        },
                    },
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
        <ScheduleXCalendar :calendar-app="calendarApp" />
    </div>
</template>

<style scoped>
.sx-vue-calendar-wrapper {
    width: 100%;
    max-width: 100vw;
    height: 500px;
    max-height: 90vh;
}
</style>
