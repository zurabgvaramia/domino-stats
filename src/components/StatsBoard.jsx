import { useState } from 'react'
import { Link } from 'react-router-dom'
import { diffCount, formatPct, formatSigned } from '../lib/format'
import { sortRows, splitByMin, STAT_COLUMNS } from '../lib/stats'
import { useWide } from '../lib/useWide'

function signedClass(value) {
  const n = Number(value)
  if (n > 0) return 'pos'
  if (n < 0) return 'neg'
  return ''
}

function Details({ row }) {
  return (
    <div className="stat-more">
      <p>თამაში {row.games} · მოგება {row.wins} · წაგება {row.losses}</p>
      <p>
        ქულები {formatSigned(row.net_points)} (მოიგო {row.points_won ?? 0}, დათმო {row.points_lost ?? 0})
      </p>
      <p>კოქსი {row.koksi_made ?? 0} / {row.koksi_taken ?? 0}</p>
      <p>სუხოი {row.sukhoi_made ?? 0} / {row.sukhoi_taken ?? 0}</p>
    </div>
  )
}

function Row({ row, place, name, href, wide, open, onToggle }) {
  const points = formatSigned(row.net_points)
  const koksi = formatSigned(diffCount(row, 'koksi_made', 'koksi_taken'))
  const sukhoi = formatSigned(diffCount(row, 'sukhoi_made', 'sukhoi_taken'))
  return (
    <div className={open ? 'stat-block open' : 'stat-block'}>
      <div
        className={wide ? 'stat-row wide' : 'stat-row'}
        onClick={wide ? undefined : onToggle}
        onKeyDown={wide ? undefined : (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggle()
          }
        }}
        role={wide ? undefined : 'button'}
        tabIndex={wide ? undefined : 0}
        aria-expanded={wide ? undefined : open}
      >
        <span className={`place${place && place <= 3 ? ` place-${place}` : ''}`}>{place || '·'}</span>
        {href ? <Link to={href} onClick={(event) => event.stopPropagation()}>{name}</Link> : <span>{name}</span>}
        <span className="c-games">{row.games}</span>
        <span className="c-wins">{row.wins}</span>
        <span className="c-losses">{row.losses}</span>
        <span className="c-pct">{formatPct(row)}</span>
        <span className={`c-pts ${signedClass(row.net_points)}`}>{points}</span>
        <span className={`c-koksi ${signedClass(diffCount(row, 'koksi_made', 'koksi_taken'))}`}>{koksi}</span>
        <span className={`c-sukhoi ${signedClass(diffCount(row, 'sukhoi_made', 'sukhoi_taken'))}`}>{sukhoi}</span>
      </div>
      {!wide && open ? <Details row={row} /> : null}
    </div>
  )
}

export default function StatsBoard({
  rows,
  min,
  onMin,
  sort,
  dir,
  onSort,
  nameOf,
  hrefOf,
  rowId,
  empty,
  noun,
}) {
  const wide = useWide()
  const [openId, setOpenId] = useState(null)
  const sorted = sortRows(rows, sort, dir, nameOf)
  const { qualified, bench } = splitByMin(sorted, min)

  return (
    <div className="board">
      <div className="min-filter">
        <label>
          მინიმუმ
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={min}
            aria-label="მინიმუმ თამაში"
            onChange={(event) => onMin(event.target.value === '' ? 0 : Number(event.target.value))}
          />
          თამაში
        </label>
        <div className="presets">
          {[0, 3, 5, 10].map((value) => (
            <button key={value} type="button" className={min === value ? 'on' : ''} onClick={() => onMin(value)}>
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="sortbar" role="toolbar" aria-label="დალაგება">
        {STAT_COLUMNS.map((column) => (
          <button
            key={column.key}
            type="button"
            title={column.title}
            className={sort === column.key ? 'on' : ''}
            onClick={() => onSort(column.key)}
          >
            {column.label}
            {sort === column.key ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}
          </button>
        ))}
      </div>

      {wide ? (
        <div className="stat-head" aria-hidden="true">
          <span>#</span>
          <span>სახელი</span>
          <span>თ</span>
          <span>მ</span>
          <span>წ</span>
          <span>%</span>
          <span>ქულები</span>
          <span>კოქსი</span>
          <span>სუხოი</span>
        </div>
      ) : null}

      {qualified.length === 0 ? (
        <p className="empty">{rows.length === 0 ? empty : `მინიმუმ ${min} თამაში ვერავინ მიაღწია.`}</p>
      ) : (
        qualified.map((row, index) => {
          const id = rowId(row)
          return (
            <Row
              key={id}
              row={row}
              place={index + 1}
              name={nameOf(row)}
              href={hrefOf(row)}
              wide={wide}
              open={openId === id}
              onToggle={() => setOpenId(openId === id ? null : id)}
            />
          )
        })
      )}

      {bench.length > 0 ? (
        <section className="bench">
          <h2>ნაკლები თამაში</h2>
          <p className="hint">{noun} {min} თამაშზე ნაკლებით ცალკეა გამოტანილი.</p>
          {bench.map((row) => {
            const id = rowId(row)
            return (
              <Row
                key={id}
                row={row}
                place={null}
                name={nameOf(row)}
                href={hrefOf(row)}
                wide={wide}
                open={openId === id}
                onToggle={() => setOpenId(openId === id ? null : id)}
              />
            )
          })}
        </section>
      ) : null}
    </div>
  )
}
