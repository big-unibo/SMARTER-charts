<script setup>
const props = defineProps(['calendarEvent'])

function handleClose() {
    props.calendarEvent = null
}

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
    } else {
        return `${dateFormatter.format(startDate)} ${timeFormatter.format(startDate)} – ${dateFormatter.format(endDate)} ${dateFormatter.format(endDate)}`
    }
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '—'
    const ts = timestamp < 1e12 ? timestamp * 1000 : timestamp
    const date = new Date(ts)
    return new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date)
}
</script>

<template>
    <div class="custom-event-modal">
        <button class="close-btn" @click="handleClose">×</button>

        <div class="event-title">
            {{ calendarEvent.title }}
        </div>

        <div class="event-time">
            {{ formatEventDate(calendarEvent.start, calendarEvent.end) }}
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
                    "Noncalcolato" }}</span>
            </p>

            <p>
                <span class="label">Durata: </span>
                <span>{{ calendarEvent.customData.duration !== null ? calendarEvent.customData.duration + " minuti" :
                    "Non calcolata" }}</span>
            </p>

            <p>
                <span class="label">Acqua extra sistema: </span>
                <span>{{ calendarEvent.customData.expectedWater ? calendarEvent.customData.expectedWater : 0 }} L</span>
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

            <p v-if="calendarEvent.customData.note">
                <span class="label">Note: </span>
                <span>{{ calendarEvent.customData.note }}</span>
            </p>

        </div>
    </div>
</template>



<style scoped>
.custom-event-modal {
    padding: 26px;
    background: #fff;
    color: black;
    border: 1px solid rgb(224 224 224);
    border-radius: 8px;
    box-shadow: 0 12px 24px #00000017, 0 6px 12px #0000002e;
    max-width: 420px;
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
