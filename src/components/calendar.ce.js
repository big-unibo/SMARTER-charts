
import { createApp, h, ref } from 'vue'
import Calendar from './calendar.vue'
import scheduleXStyles from '@schedule-x/theme-default/dist/index.css?inline'

export class CalendarElement extends HTMLElement {
  static get observedAttributes() {
    return ['config']
  }

  connectedCallback() {
    const mountPoint = document.createElement('div')

    const styleTag = document.createElement('style')
    styleTag.textContent = scheduleXStyles ;
    this.appendChild(styleTag)
    this.appendChild(mountPoint)
    
    this._configRef = ref(this.getAttribute('config'))

    this.app = createApp({
      render: () =>
        h(Calendar, {
          config: this._configRef.value
        })
    })

    this.app.mount(mountPoint)
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'config' && this._configRef) {
      this._configRef.value = newValue
    }
  }

  disconnectedCallback() {
    if (this.app) this.app.unmount()
  }
}

