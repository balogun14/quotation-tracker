import { useMemo } from 'react'
import { ArrowRight24Regular, CheckmarkCircle24Regular, Send24Regular, Timer24Regular, Warning24Regular } from '@fluentui/react-icons'
import { money } from '../data.js'
import { Avatar, EmptyState, StatusPill } from '../ui.jsx'

export function FollowUps({ quotes, onFollowUp, onOpenQuote }) {
  const groups = useMemo(() => {
    const now = new Date()
    const overdue = quotes.filter((q) => q.followUp === 'Overdue')
    const upcoming = quotes.filter(
      (q) => !['Overdue', 'Completed', 'Closed'].includes(q.followUp) && !['Booked', 'Lost'].includes(q.status),
    )
    return { overdue, upcoming, now }
  }, [quotes])

  const total = groups.overdue.length + groups.upcoming.length

  return (
    <div className="view">
      <section className="view-head">
        <div>
          <span className="eyebrow">Follow-ups</span>
          <h1>Follow-ups</h1>
          <p>Keep momentum with clients who are still deciding.</p>
        </div>
      </section>

      {total === 0 ? (
        <div className="panel">
          <EmptyState
            icon={CheckmarkCircle24Regular}
            title="You're all caught up"
            body="No follow-ups are due right now. New reminders will appear here automatically."
          />
        </div>
      ) : (
        <>
          {groups.overdue.length > 0 && (
            <section className="follow-group">
              <div className="follow-group-head overdue">
                <span className="follow-group-icon">
                  <Warning24Regular />
                </span>
                <div>
                  <h2>Overdue</h2>
                  <p>These leads are at risk of going cold.</p>
                </div>
                <span className="follow-count">{groups.overdue.length}</span>
              </div>
              <div className="follow-cards">
                {groups.overdue.map((q) => (
                  <FollowCard key={q.id} q={q} onFollowUp={onFollowUp} onOpenQuote={onOpenQuote} overdue />
                ))}
              </div>
            </section>
          )}

          {groups.upcoming.length > 0 && (
            <section className="follow-group">
              <div className="follow-group-head">
                <span className="follow-group-icon">
                  <Timer24Regular />
                </span>
                <div>
                  <h2>Upcoming</h2>
                  <p>Scheduled reminders for the coming days.</p>
                </div>
                <span className="follow-count">{groups.upcoming.length}</span>
              </div>
              <div className="follow-cards">
                {groups.upcoming.map((q) => (
                  <FollowCard key={q.id} q={q} onFollowUp={onFollowUp} onOpenQuote={onOpenQuote} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function FollowCard({ q, onFollowUp, onOpenQuote, overdue }) {
  return (
    <article className={`follow-card ${overdue ? 'is-overdue' : ''}`}>
      <Avatar name={q.client} />
      <div className="follow-card-body">
        <div className="follow-card-top">
          <div>
            <strong>{q.client}</strong>
            <small>{q.company}</small>
          </div>
          <StatusPill status={q.status} />
        </div>
        <p>{q.service}</p>
        <div className="follow-card-meta">
          <span>{money.format(q.value)}</span>
          <span>·</span>
          <span>Sent {q.sent}</span>
          <span>·</span>
          <span className={overdue ? 'overdue-text' : ''}>{overdue ? 'Overdue' : `Due ${q.followUp}`}</span>
        </div>
      </div>
      <div className="follow-card-actions">
        <button className="btn btn-ghost" onClick={() => onOpenQuote(q)}>
          View <ArrowRight24Regular />
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => onFollowUp(q)}>
          <Send24Regular />
          Follow up
        </button>
      </div>
    </article>
  )
}
