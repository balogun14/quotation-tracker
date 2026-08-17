import { useMemo, useState } from 'react'
import { ArrowSort24Regular, Search24Regular } from '@fluentui/react-icons'
import { money, STAGES, STATUS_META } from '../data.js'
import { Avatar, EmptyState, StatusPill } from '../ui.jsx'

export function Quotations({ quotes, initialFilter, onNewQuote, onOpenQuote }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(initialFilter || 'All')
  const [sort, setSort] = useState('recent')

  const visible = useMemo(() => {
    return quotes.filter(
      (q) =>
        (filter === 'All' || q.status === filter) &&
        `${q.client} ${q.company} ${q.service}`.toLowerCase().includes(query.toLowerCase()),
    )
  }, [quotes, filter, query])

  const sorted = useMemo(() => {
    const list = [...visible]
    if (sort === 'value') list.sort((a, b) => b.value - a.value)
    else if (sort === 'name') list.sort((a, b) => a.client.localeCompare(b.client))
    return list
  }, [visible, sort])

  return (
    <div className="view">
      <section className="view-head">
        <div>
          <span className="eyebrow">Quotations</span>
          <h1>All quotations</h1>
          <p>Manage follow-ups and update outcomes as you go.</p>
        </div>
      </section>

      <section className="panel">
        <div className="toolbar">
          <div className="chip-row">
            {['All', ...STAGES].map((s) => (
              <button
                key={s}
                className={`chip ${filter === s ? 'active' : ''}`}
                onClick={() => setFilter(s)}
              >
                {s === 'All' ? 'All' : STATUS_META[s].label}
                <span className="chip-count">
                  {s === 'All' ? quotes.length : quotes.filter((q) => q.status === s).length}
                </span>
              </button>
            ))}
          </div>
          <div className="toolbar-right">
            <div className="search">
              <Search24Regular />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search client, company or service"
              />
            </div>
            <div className="sort-select">
              <ArrowSort24Regular />
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort quotations">
                <option value="recent">Most recent</option>
                <option value="value">Highest value</option>
                <option value="name">Client A–Z</option>
              </select>
            </div>
          </div>
        </div>

        {sorted.length === 0 ? (
          <EmptyState
            icon={Search24Regular}
            title="No quotations found"
            body="Try a different search or create a new quotation."
            action={<button className="btn btn-primary" onClick={onNewQuote}>New quotation</button>}
          />
        ) : (
          <>
            <div className="table-head">
              <span>Client</span>
              <span>Service</span>
              <span>Value</span>
              <span>Status</span>
              <span>Follow-up</span>
              <span>Sent</span>
            </div>
            <div className="table-body">
              {sorted.map((q) => (
                <button className="table-row" key={q.id} onClick={() => onOpenQuote(q)}>
                  <span className="cell-client">
                    <Avatar name={q.client} />
                    <span>
                      <strong>{q.client}</strong>
                      <small>{q.company}</small>
                    </span>
                  </span>
                  <span className="cell-service">{q.service}</span>
                  <span className="cell-value">{money.format(q.value)}</span>
                  <span className="cell-status">
                    <StatusPill status={q.status} />
                  </span>
                  <span className={`cell-follow ${q.followUp === 'Overdue' ? 'overdue' : ''}`}>
                    {q.followUp}
                  </span>
                  <span className="cell-sent">Sent {q.sent}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
