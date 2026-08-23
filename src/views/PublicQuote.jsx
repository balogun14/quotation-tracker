import { useEffect, useMemo, useState } from 'react'
import { formatMinor } from '../adapt.js'

export function PublicQuote({ token }) {
  const [view, setView] = useState(null)
  const [error, setError] = useState('')
  const [deciding, setDeciding] = useState(false)

  useEffect(() => {
    fetch(`/api/v1/public/p/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error?.message || 'This quotation is unavailable.')
        setView(body)
      })
      .catch((err) => setError(err.message || 'This quotation is unavailable.'))
  }, [token])

  const quote = view?.snapshot?.quote
  const items = useMemo(() => view?.snapshot?.items || [], [view])
  const decide = async (decision) => {
    setDeciding(true)
    try {
      const res = await fetch(`/api/v1/public/p/${encodeURIComponent(token)}/decide`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error?.message || 'Could not record your response.')
      setView((current) => ({ ...current, status: decision, decision }))
    } catch (err) {
      setError(err.message || 'Could not record your response.')
    } finally {
      setDeciding(false)
    }
  }

  if (error && !quote) return <main className="public-quote"><section className="public-card"><h1>Quotation unavailable</h1><p>{error}</p></section></main>
  if (!quote) return <main className="public-quote"><section className="public-card"><p>Loading quotation…</p></section></main>
  const money = (minor) => formatMinor(minor, quote.currency)
  const completed = view.decision || ['accepted', 'declined'].includes(view.status)
  return (
    <main className="public-quote">
      <section className="public-card">
        <span className="eyebrow">Quotation from {view.snapshot.workspace.businessName}</span>
        <h1>{quote.serviceDescription}</h1>
        <p className="public-client">Prepared for {quote.clientName}{quote.clientCompany ? ` · ${quote.clientCompany}` : ''}</p>
        <div className="public-lines">
          {items.map((item) => <div key={item.id}><span>{item.description} × {item.quantity}</span><strong>{money(item.quantity * item.unitPriceMinor)}</strong></div>)}
          <div className="public-total"><span>Total</span><strong>{money(quote.totalMinor)}</strong></div>
        </div>
        {quote.notes && <p className="public-notes">{quote.notes}</p>}
        {error && <div className="form-error">{error}</div>}
        {completed ? <p className="public-response">Thank you. Your response has been recorded.</p> : (
          <div className="public-actions">
            <button className="btn btn-ghost" disabled={deciding} onClick={() => decide('declined')}>Decline</button>
            <button className="btn btn-primary" disabled={deciding} onClick={() => decide('accepted')}>{deciding ? 'Saving…' : 'Accept quotation'}</button>
          </div>
        )}
      </section>
    </main>
  )
}
