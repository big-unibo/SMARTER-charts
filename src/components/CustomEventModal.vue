<template>
    <div class="custom-event-modal">
        <p></p>
        {{ calendarEvent.title }}
    </div>
</template>

<script setup>
defineProps(['calendarEvent'])
</script>

<style scoped>
.custom-event-modal {
    padding: 40px;
    background: yellow;
    color: black;
    border-radius: 24px;
    border: 1px solid black;
    font-size: 24px;
    font-weight: bold;
}
</style>
