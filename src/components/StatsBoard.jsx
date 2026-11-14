import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatSigned, WIN_LABEL } from '../lib/format'
import { assignPlaces, compareRank } from '../lib/ranking'
import { sortRows, splitByMin, STAT_COLUMNS } from '../lib/stats'
import { useWide } from '../lib/useWide'

function count(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function signedClass(value) {
  const n = Number(value)
  if (n > 0) return 'pos'
  if (n < 0) return 'neg'
  return ''
}

function rankQualified(rows, sort, dir, nameOf, trustPlace) {
  const placed = trustPlace ? rows : assignPlaces([...rows].sort(compareRank))
  if (sort === 'place') {
    if (!trustPlace) return placed
    return [...placed].sort((a, b) => (count(a.place) - count(b.place)) || compareRank(a, b))
  }
  return sortRows(placed, sort, dir, nameOf)
}

function rankBench(rows, sort, dir, nameOf) {
  if (sort === 'place') return [...rows].sort(compareRank)
  return sortRows(rows, sort, dir, nameOf)
}

function Details({ row }) {
  return (
    <div className="stat-more">
      <p>თამაში {count(row.games)}</p>
      <p>მოგება (ქულა) {count(row.points_won)}</p>
      <p>წაგება (ქულა) {count(row.points_lost)}</p>
      <p>{WIN_LABEL.regular} {count(row.oini_made)}</p>
      <p>მიიღო {WIN_LABEL.regular} {count(row.oini_taken)}</p>
      <p>მიიღო {WIN_LABEL.sukhoi} {count(row.sukhoi_taken)}</p>
      <p>მიიღო {WIN_LABEL.koksi} {count(row.koksi_taken)}</p>
    </div>
  )
}

function fromLink(event) {
  const node = event.target instanceof Element ? event.target : event.target?.parentElement
  return Boolean(node?.closest?.('a'))
}

function NameCell({ href, name }) {
  if (!href) return <span className="name-cell">{name}</span>
  return <Link className="name-cell" to={href} onClick={(event) => event.stopPropagation()}>{name}</Link>
}

function Row({ row, place, name, href, wide, open, onToggle }) {
  const pointsClass = signedClass(row.net_points)
  return (
    <div className={!wide && open ? 'stat-block open' : 'stat-block'}>
      <div
        className={wide ? 'stat-row wide' : 'stat-row'}
        onClick={wide ? undefined : (event) => {
          if (fromLink(event)) return
          onToggle()
        }}
        onKeyDown={wide ? undefined : (event) => {
          if (fromLink(event)) return
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
        <NameCell href={href} name={name} />
        <span className="c-games">{count(row.games)}</span>
        <span className="c-wins">{count(row.points_won)}</span>
        <span className="c-losses">{count(row.points_lost)}</span>
        <span className={pointsClass ? `c-pts ${pointsClass}` : 'c-pts'}>{formatSigned(row.net_points)}</span>
        <span hidden={!wide} style={{ fontVariantNumeric: 'tabular-nums' }}>{count(row.oini_made)}</span>
        <span className="c-sukhoi">{count(row.sukhoi_made)}</span>
        <span className="c-koksi">{count(row.koksi_made)}</span>
        {wide ? null : (
          <span style={{ order: 4, fontVariantNumeric: 'tabular-nums' }}>
            {`კ ${count(row.koksi_made)} · ს ${count(row.sukhoi_made)}`}
          </span>
        )}
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
  renderName,
  hrefOf,
  rowId,
  empty,
  noun,
  showMin = true,
  nameLabel = '',
  trustPlace = false,
}) {
  const wide = useWide()
  const [openId, setOpenId] = useState(null)
  const { qualified, bench } = splitByMin(rows, min)
  const ranked = rankQualified(qualified, sort, dir, nameOf, trustPlace)
  const rest = rankBench(bench, sort, dir, nameOf)
  const columns = STAT_COLUMNS.map((column) => {
    if (column.key !== 'name' || !nameLabel) return column
    return { ...column, label: nameLabel, title: nameLabel }
  })

  return (
    <div className="board">
      {showMin ? (
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
      ) : null}

      <div className="sortbar" role="toolbar" aria-label="დალაგება">
        {columns.map((column) => (
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
          {columns.map((column) => <span key={column.key}>{column.title}</span>)}
        </div>
      ) : null}

      {ranked.length === 0 ? (
        <p className="empty">{rows.length === 0 ? empty : `მინიმუმ ${min} თამაში ვერავინ მიაღწია.`}</p>
      ) : (
        ranked.map((row) => {
          const id = rowId(row)
          return (
            <Row
              key={id}
              row={row}
              place={row.place}
              name={renderName ? renderName(row) : nameOf(row)}
              href={hrefOf(row)}
              wide={wide}
              open={openId === id}
              onToggle={() => setOpenId(openId === id ? null : id)}
            />
          )
        })
      )}

      {rest.length > 0 ? (
        <section className="bench">
          <h2>ნაკლები თამაში</h2>
          <p className="hint">{noun} {min} თამაშზე ნაკლებით ცალკეა გამოტანილი.</p>
          {rest.map((row) => {
            const id = rowId(row)
            return (
              <Row
                key={id}
                row={row}
                place={null}
                name={renderName ? renderName(row) : nameOf(row)}
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
