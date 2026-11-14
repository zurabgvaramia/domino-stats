import { PERIODS } from '../lib/dates'

export default function PeriodPicker({ period, from, to, onPeriod, onDate }) {
  return (
    <div className="period-box">
      <div className="periods" role="tablist" aria-label="პერიოდი">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={period === item.id}
            className={period === item.id ? 'on' : ''}
            onClick={() => onPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="custom-range">
          <input
            type="date"
            aria-label="თარიღიდან"
            value={from}
            onChange={(event) => onDate('from', event.target.value)}
          />
          <span aria-hidden="true">–</span>
          <input
            type="date"
            aria-label="თარიღამდე"
            value={to}
            onChange={(event) => onDate('to', event.target.value)}
          />
        </div>
      )}
    </div>
  )
}
