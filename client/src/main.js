import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/variables.css'
import './styles/global.css'

import zh from './i18n/zh.json'
import en from './i18n/en.json'
import ja from './i18n/ja.json'

const savedLocale = localStorage.getItem('locale') || 'zh'
const savedTheme = localStorage.getItem('theme') || 'light'

document.documentElement.setAttribute('data-theme', savedTheme)

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'zh',
  messages: { zh, en, ja }
})

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(i18n)
app.mount('#app')
