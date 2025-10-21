<script setup>
import MonitoringPage from "./components-develop/MonitoringPage.vue";
import { registerChartComponents } from "./main";

registerChartComponents();

</script>

<template>
  <div class="test-page">
    <MonitoringPage />
  </div>
</template>

<style scoped>
@media (min-width: 1024px) {

  .app-body{
    display: flex;
    place-items: center;
  }

  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  body {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>