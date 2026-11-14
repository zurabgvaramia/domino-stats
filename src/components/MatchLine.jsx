import { formatTime } from '../lib/dates'
import { WIN_LABEL, WIN_POINTS } from '../lib/format'
import { PairName } from './PlayerName'

export default function MatchLine({ match, byId, onClick }) {
  const aWon = match.winner === 'A'
  const className = `match-line${match.is_void ? ' is-void' : ''}`
  const typeLabel = WIN_LABEL[match.win_type]
  const typePoints = WIN_POINTS[match.win_type]
  const typeMark = match.win_type && match.win_type !== 'regular' && typeLabel && typePoints
    ? `${typeLabel} +${typePoints}`
    : null
  const body = (
    <>
      <time dateTime={match.played_at}>{formatTime(match.played_at)}</time>
      <div className="pairs">
        <div className={aWon ? 'win' : 'lose'}><PairName a={match.a1} b={match.a2} byId={byId} compact /></div>
        <div className={!aWon ? 'win' : 'lose'}><PairName a={match.b1} b={match.b2} byId={byId} compact /></div>
        {match.note ? <div className="note">{match.note}</div> : null}
      </div>
      <div className="marks">
        {typeMark ? <span className={`badge badge-${match.win_type}`}>{typeMark}</span> : null}
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
