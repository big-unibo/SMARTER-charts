import { createApp } from "vue";
import AppTest from "@/develop/App-test.vue";
import 'bootstrap/dist/css/bootstrap.css'

//Needed in order to fix the problem with vite not seeing the external bootstrap import
import * as bootstrap from 'bootstrap'
window.bootstrap = bootstrap;


createApp(AppTest).mount("#app");
