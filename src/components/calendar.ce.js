import { createApp, h, ref } from 'vue'
import Calendar from './calendar.vue'
import scheduleXStyles from '@schedule-x/theme-default/dist/index.css?inline'
import calendarStyles from '../assets/calendar.css?inline';

export class CalendarElement extends HTMLElement {

  static get observedAttributes() {
    return ['config', 'isEditable']
  }

  constructor() {
    super()
    this._configProp = null
    this._configRef = null
    this._isEditableProp = false
    this._isEditableRef = null
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

  set isEditable(value) {
    this._isEditableProp = value
    if (this._isEditableRef) {
      this._isEditableRef.value = value
    }
  }

  get isEditable() {
    return this._isEditableProp
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'config') {
      let parsed = newValue
      this._configProp = parsed
      if (this._configRef) {
        this._configRef.value = parsed
      }
    } else if (name === 'isEditable') {
      this.isEditable = newValue === 'true'
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
    this._isEditableRef = ref(this._isEditableProp)
    this.app = createApp({
      render: () =>
        h(Calendar, {
          config: this._configRef.value,
          isEditable: this._isEditableRef.value
        })
    })

    this.app.mount(mountPoint)
  }

  disconnectedCallback() {
    if (this.app) this.app.unmount()
  }
}