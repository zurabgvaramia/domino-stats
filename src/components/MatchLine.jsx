import { formatTime } from '../lib/dates'
import { WIN_LABEL } from '../lib/format'

export default function MatchLine({ match, nameOf, onClick }) {
  const aWon = match.winner === 'A'
  const className = `match-line${match.is_void ? ' is-void' : ''}`
  const body = (
    <>
      <time dateTime={match.played_at}>{formatTime(match.played_at)}</time>
      <div className="pairs">
        <div className={aWon ? 'win' : 'lose'}>{nameOf(match.a1)} · {nameOf(match.a2)}</div>
        <div className={!aWon ? 'win' : 'lose'}>{nameOf(match.b1)} · {nameOf(match.b2)}</div>
        {match.note ? <div className="note">{match.note}</div> : null}
      </div>
      <div className="marks">
        {match.win_type && match.win_type !== 'regular' ? (
          <span className={`badge badge-${match.win_type}`}>{WIN_LABEL[match.win_type]}</span>
        ) : null}
        {match.is_void ? <span className="badge badge-void">გაუქმებული</span> : null}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {body}
      </button>
    )
  }
  return <div className={className}>{body}</div>
}
