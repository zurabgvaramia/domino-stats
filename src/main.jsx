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

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

boot()
