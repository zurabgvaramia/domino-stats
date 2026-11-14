import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { supabase } from './lib/supabase'
import './index.css'

async function boot() {
  if (supabase) {
    try {
      await supabase.auth.getSession()
    } catch (error) {
      console.error(error)
    }
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  const hashParams = new URLSearchParams(hash)
  if (hashParams.get('error_description')) {
    sessionStorage.setItem('auth-error', hashParams.get('error_description'))
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/login`)
  } else if (hash.includes('access_token=')) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`)
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

boot()
