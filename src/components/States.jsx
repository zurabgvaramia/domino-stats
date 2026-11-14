export function Skeleton({ rows = 4 }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} style={{ width: `${92 - (index % 3) * 14}%` }} />
      ))}
    </div>
  )
}

export function ErrorNote({ message, onRetry }) {
  return (
    <div className="error-note" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>თავიდან</button>
      ) : null}
    </div>
  )
}

export function EmptyNote({ children }) {
  return <p className="empty">{children}</p>
}
