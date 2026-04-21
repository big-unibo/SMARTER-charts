import { createApp, h, ref } from 'vue'
import Calendar from './calendar.vue'
import scheduleXStyles from '@schedule-x/theme-default/dist/index.css?inline'
import calendarStyles from '../assets/calendar.css?inline';

export class CalendarElement extends HTMLElement {

  static get observedAttributes() {
    return ['config']
  }

  constructor() {
    super()
    this._configProp = null
    this._configRef = null
  }

  set config(value) {
    this._configProp = value

    if (this._configRef) {
      this._configRef.value = value
    }
  }

  get config() {
    return this._configProp
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'config') {
      let parsed = newValue
      this._configProp = parsed
      if (this._configRef) {
        this._configRef.value = parsed
      }
    }
  }

  connectedCallback() {
    const mountPoint = document.createElement('div')

    const scheduleXStyleTag = document.createElement('style')
    scheduleXStyleTag.textContent = scheduleXStyles
    this.appendChild(scheduleXStyleTag)
    this.appendChild(mountPoint)
    const calendarStyleTag = document.createElement('style');
    calendarStyleTag.textContent = calendarStyles;
    this.appendChild(calendarStyleTag);

    if (this._configProp == null) {
      const attr = this.getAttribute('config')
      if (attr) {
          this._configProp = attr
      }
    }

    this._configRef = ref(this._configProp)

    this.app = createApp({
      render: () =>
        h(Calendar, {
          config: this._configRef.value
        })
    })

    this.app.mount(mountPoint)
  }

  disconnectedCallback() {
    if (this.app) this.app.unmount()
  }
}