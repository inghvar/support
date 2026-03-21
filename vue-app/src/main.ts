import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'

const styles = getComputedStyle(document.documentElement)

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'custom',
    themes: {
      custom: {
        colors: {
          background: styles.getPropertyValue('--vscode-editor-background').trim(),
          surface: styles.getPropertyValue('--vscode-editor-background').trim(),
          primary: styles.getPropertyValue('--vscode-button-background').trim(),
          onBackground: styles.getPropertyValue('--vscode-editor-foreground').trim(),
        }
      }
    }
  }
})

const app = createApp(App)

app.use(createPinia())
app.use(vuetify)

app.mount('#app')
