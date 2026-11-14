import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isSupabaseConfigured } from '../lib/supabase'
import { DominoMark } from './Icons'
import BottomNav from './BottomNav'

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export default function Layout({ children }) {
  const online = useOnline()

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/table" className="brand">
          <DominoMark />
          <span>დომინო</span>
        </Link>
      </header>
      {!online && (
        <div className="offline-banner" role="status">
          ინტერნეტი არ არის. ჩაწერილი პარტია არ შეინახება.
        </div>
      )}
      {!isSupabaseConfigured && (
        <div className="config-banner" role="status">
          Supabase არ არის მორგებული. დააკოპირე .env.example ფაილი .env-ად და ჩაწერე მისამართი და გასაღები.
        </div>
      )}
      <main className="main">{children}</main>
      <BottomNav />
    </div>
  )
}
