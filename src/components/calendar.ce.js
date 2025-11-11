
import { createApp } from 'vue'
import Calendar from './calendar.vue'

export class CalendarElement extends HTMLElement {
  connectedCallback() {
    const mountPoint = document.createElement('div')
    this.appendChild(mountPoint)

    const props = {}
    for (const attr of this.attributes) props[attr.name] = attr.value

    this.app = createApp(Calendar, props)
    this.app.mount(mountPoint)

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const propName = mutation.attributeName
          const newValue = this.getAttribute(propName)
          this.app._instance.props[propName] = newValue
        }
      }
    })
    this.observer.observe(this, { attributes: true })
  }

  disconnectedCallback() {
    if (this.app) this.app.unmount()
  }
}

