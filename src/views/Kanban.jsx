import { useState } from 'react'
import { Add24Regular, MoreHorizontal24Regular } from '@fluentui/react-icons'
import { money, STAGES, STATUS_META } from '../data.js'
import { Avatar } from '../ui.jsx'

export function Kanban({ quotes, onMove, onOpenQuote, onNewQuote }) {
  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)
  const [menuId, setMenuId] = useState(null)

  const handleDrop = (status) => {
    if (dragId != null) onMove(dragId, status)
    setDragId(null)
    setOverCol(null)
  }

  return (
    <div className="view view-board">
      <section className="view-head">
        <div>
          <span className="eyebrow">Board</span>
          <h1>Pipeline board</h1>
          <p>Drag a card to move it between stages, or tap the arrow for quick actions.</p>
        </div>
      </section>

      <div className="board">
        {STAGES.map((status) => {
          const items = quotes.filter((q) => q.status === status)
          const value = items.reduce((s, q) => s + q.value, 0)
          return (
            <div
              key={status}
              className={`board-col ${overCol === status ? 'over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                if (overCol !== status) setOverCol(status)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setOverCol((c) => (c === status ? null : c))
              }}
              onDrop={() => handleDrop(status)}
            >
              <header className="board-col-head">
                <div className="board-col-title">
                  <i className={`dot ${STATUS_META[status].className}`} />
                  <h3>{STATUS_META[status].label}</h3>
                  <span className="board-count">{items.length}</span>
                </div>
                <span className="board-value">{money.format(value)}</span>
              </header>

              <div className="board-cards">
                {items.map((q) => (
                  <article
                    key={q.id}
                    className={`board-card ${dragId === q.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => setDragId(q.id)}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverCol(null)
                    }}
                  >
                    <div className="board-card-top">
                      <Avatar name={q.client} />
                      <span className="board-card-menu">
                        <button
                          className="icon-btn icon-btn-sm"
                          onClick={() => setMenuId(menuId === q.id ? null : q.id)}
                          aria-label="Card actions"
                        >
                          <MoreHorizontal24Regular />
                        </button>
                        {menuId === q.id && (
                          <div className="menu-pop">
                            <button onClick={() => { onOpenQuote(q); setMenuId(null) }}>Open details</button>
                            <span className="menu-label">Move to</span>
                            {STAGES.filter((s) => s !== q.status).map((s) => (
                              <button key={s} onClick={() => { onMove(q.id, s); setMenuId(null) }}>
                                <i className={`dot ${STATUS_META[s].className}`} />
                                {STATUS_META[s].label}
                              </button>
                            ))}
                          </div>
                        )}
                      </span>
                    </div>

                    <button className="board-card-main" onClick={() => onOpenQuote(q)}>
                      <strong>{q.client}</strong>
                      <span>{q.company}</span>
                      <p>{q.service}</p>
                    </button>

                    <div className="board-card-foot">
                      <span className="board-amount">{money.format(q.value)}</span>
                      <span className={`board-follow ${q.followUp === 'Overdue' ? 'overdue' : ''}`}>
                        {q.followUp === 'Overdue' ? 'Overdue' : `Follow-up ${q.followUp}`}
                      </span>
                    </div>
                  </article>
                ))}

                {items.length === 0 && (
                  <div className="board-empty">Drop a card here to move it to {STATUS_META[status].label}.</div>
                )}

                <button className="board-add" onClick={() => onNewQuote(status)}>
                  <Add24Regular />
                  Add quotation
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
