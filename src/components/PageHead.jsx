import { useTitle } from '../lib/useTitle'

export default function PageHead({ title, kicker, children }) {
  useTitle(title)
  return (
    <div className="page-head">
      {kicker ? <p className="kicker">{kicker}</p> : null}
      <h1>{title}</h1>
      {children}
    </div>
  )
}
