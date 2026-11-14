import { useTitle } from '../lib/useTitle'

export default function PageHead({ title, kicker, heading, children }) {
  useTitle(title)
  return (
    <div className="page-head">
      {kicker ? <p className="kicker">{kicker}</p> : null}
      <h1>{heading || title}</h1>
      {children}
    </div>
  )
}
