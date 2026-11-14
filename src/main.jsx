import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import { holdUpdateForRecord, shouldHoldUpdate } from './lib/appUpdate'
import { supabase } from './lib/supabase'
import './index.css'

const UPDATE_INTERVAL = 30 * 60 * 1000

if ('serviceWorker' in navigator) {
  let refreshing = false
  let sawController = Boolean(navigator.serviceWorker.controller)
  const takeUpdate = () => {
    if (refreshing) return
    if (shouldHoldUpdate()) {
      holdUpdateForRecord()
      return
    }
    refreshing = true
    window.location.reload()
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!sawController) {
      sawController = true
      return
    }
    takeUpdate()
  })

  registerSW({
    immediate: true,
    onNeedReload: takeUpdate,
    onRegisteredSW(_url, registration) {
      if (!registration) return undefined
      const check = () => {
        registration.update().catch(() => {})
      }
      check()
      return window.setInterval(check, UPDATE_INTERVAL)
    },
  })
}

async function boot() {
  if (supabase) {
    try {
      await supabase.auth.getSession()
    } catch (error) {
      console.error(error)
    }
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

boot()
