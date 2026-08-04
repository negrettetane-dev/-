import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles.css'
import './amap.css'

createApp(App).use(createPinia()).use(router).mount('#app')

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/offline-map-sw.js').catch(() => undefined))
}
