import { NavLink, useLocation } from 'react-router-dom'
import { periodSearchFrom } from '../lib/usePeriod'
import { IconMatches, IconMore, IconPairs, IconRecord, IconTable } from './Icons'

const TABS = [
  { to: '/', label: 'ჩაწერა', icon: IconRecord, end: true },
  { to: '/table', label: 'ცხრილი', icon: IconTable },
  { to: '/pairs', label: 'წყვილები', icon: IconPairs },
  { to: '/matches', label: 'პარტიები', icon: IconMatches },
  { to: '/more', label: 'მეტი', icon: IconMore },
]

export default function BottomNav() {
  const location = useLocation()
  const search = periodSearchFrom(location.search)

  return (
    <nav className="tabbar" aria-label="მთავარი">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const keepPeriod = tab.to !== '/'
        return (
          <NavLink
            key={tab.to}
            to={keepPeriod ? { pathname: tab.to, search } : tab.to}
            end={tab.end}
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
          >
            <Icon />
            <span>{tab.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
