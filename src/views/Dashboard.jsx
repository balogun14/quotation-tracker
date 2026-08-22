import { useMemo } from 'react'
import { Add24Regular, ArrowRight24Regular, ArrowTrending24Regular, CheckmarkCircle24Regular, Mail24Regular, Warning24Regular } from '@fluentui/react-icons'
import { money, STAGES, STATUS_META } from '../data.js'
import { Avatar, EmptyState, StatusPill } from '../ui.jsx'

export function Dashboard({ quotes, onNewQuote, onOpenQuote, onNavigate, user }) {
  const stats = useMemo(() => {
    const active = quotes.filter((q) => q.status === 'Sent' || q.status === 'Followed Up')
    const booked = quotes.filter((q) => q.status === 'Booked')
    const overdue = quotes.filter((q) => q.followUp === 'Overdue')
    const won = booked.length
    const closed = quotes.filter((q) => q.status === 'Booked' || q.status === 'Lost')
    const winRate = closed.length ? Math.round((won / closed.length) * 100) : 0
    return {
      active,
      activeValue: active.reduce((s, q) => s + q.value, 0),
      booked,
      bookedValue: booked.reduce((s, q) => s + q.value, 0),
      overdue,
      winRate,
    }
  }, [quotes])

  const recent = useMemo(() => quotes.slice(0, 5), [quotes])

  const firstName = (user?.name || 'there').split(' ')[0]

  return (
    <div className="view">
      <section className="welcome">
        <div>
          <span className="eyebrow">Overview</span>
          <h1>Good {greeting()}, {firstName}.</h1>
          <p>Here is what needs your attention today.</p>
        </div>
      </section>

      <section className="metrics">
        <article className="metric">
          <div className="metric-top">
            <span className="metric-icon">
              <ArrowTrending24Regular />
            </span>
            <span className="metric-trend">+{stats.active.length} open</span>
          </div>
          <p>Active pipeline</p>
          <strong>{money.format(stats.activeValue)}</strong>
          <small>{stats.active.length} quotes awaiting a decision</small>
        </article>
        <article className="metric">
          <div className="metric-top">
            <span className="metric-icon metric-icon-emerald">
              <CheckmarkCircle24Regular />
            </span>
            <span className="metric-trend metric-trend-up">{stats.winRate}% win rate</span>
          </div>
          <p>Booked this month</p>
          <strong>{stats.booked.length}</strong>
          <small>{money.format(stats.bookedValue)} confirmed</small>
        </article>
        <article className={`metric ${stats.overdue.length ? 'metric-alert' : ''}`}>
          <div className="metric-top">
            <span className="metric-icon metric-icon-amber">
              {stats.overdue.length ? <Warning24Regular /> : <Mail24Regular />}
            </span>
            <span className="metric-trend metric-trend-warn">{stats.overdue.length} overdue</span>
          </div>
          <p>Needs a follow-up</p>
          <strong>{stats.overdue.length}</strong>
          <small>Send a reminder before they go cold</small>
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Pipeline</h2>
            <p>Every opportunity, clearly placed.</p>
          </div>
          <div className="pipeline-key">
            {STAGES.map((s) => (
              <span key={s}>
                <i className={`dot ${STATUS_META[s].className}`} />
                {STATUS_META[s].label}
              </span>
            ))}
          </div>
        </div>
        <div className="pipeline">
          {STAGES.map((s) => {
            const items = quotes.filter((q) => q.status === s)
            const value = items.reduce((sum, q) => sum + q.value, 0)
            return (
              <button key={s} className="stage" onClick={() => onNavigate('quotations', s)}>
                <span className="stage-dot">
                  <i className={`dot ${STATUS_META[s].className}`} />
                  {STATUS_META[s].label}
                </span>
                <strong>{items.length}</strong>
                <small>{money.format(value)}</small>
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Recent quotations</h2>
            <p>Latest activity across your pipeline.</p>
          </div>
          <button className="link-btn" onClick={() => onNavigate('quotations')}>
            View all <ArrowRight24Regular />
          </button>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            icon={Add24Regular}
            title="No quotations yet"
            body="Create your first quotation to start building your pipeline."
            action={<button className="btn btn-primary" onClick={onNewQuote}>New quotation</button>}
          />
        ) : (
          <div className="list">
            {recent.map((q) => (
              <button className="list-row" key={q.id} onClick={() => onOpenQuote(q)}>
                <Avatar name={q.client} />
                <span className="list-main">
                  <strong>{q.client}</strong>
                  <small>{q.company} · {q.service}</small>
                </span>
                <span className="list-value">
                  <strong>{money.format(q.value, q.currency)}</strong>
                  <small>Sent {q.sent}</small>
                </span>
                <StatusPill status={q.status} />
                <span className="row-chevron">
                  <ArrowRight24Regular />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
