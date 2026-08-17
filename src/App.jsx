import { useEffect, useMemo, useState } from 'react'
import {
  Add24Regular,
  CheckmarkCircle24Regular,
  ChevronDown24Regular,
  Delete24Regular,
  Dismiss24Regular,
  Mail24Regular,
  Phone24Regular,
  Send24Regular,
  SignOut24Regular,
} from '@fluentui/react-icons'
import './App.css'
import { loadQuotes, money, saveQuotes, STATUS_META, STAGES } from './data.js'
import { Avatar, Field, Modal, StatusPill } from './ui.jsx'
import { Sidebar } from './components/Sidebar.jsx'
import { Auth } from './views/Auth.jsx'
import { Dashboard } from './views/Dashboard.jsx'
import { Quotations } from './views/Quotations.jsx'
import { FollowUps } from './views/FollowUps.jsx'
import { Kanban } from './views/Kanban.jsx'
import { Settings } from './views/Settings.jsx'

const LS_USER = 'quotely.user'
const VIEW_TITLES = {
  overview: 'Overview',
  quotations: 'Quotations',
  board: 'Board',
  followups: 'Follow-ups',
  settings: 'Settings',
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_USER) || 'null')
    } catch {
      return null
    }
  })
  const [quotes, setQuotes] = useState(loadQuotes)
  const [view, setView] = useState('overview')
  const [filter, setFilter] = useState('All')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    saveQuotes(quotes)
  }, [quotes])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3600)
    return () => clearTimeout(t)
  }, [toast])

  const counts = useMemo(
    () => ({
      quotations: quotes.length,
      followups: quotes.filter((q) => q.followUp === 'Overdue').length,
      board: 0,
    }),
    [quotes],
  )

  const signIn = (u) => {
    setUser(u)
    try {
      localStorage.setItem(LS_USER, JSON.stringify(u))
    } catch {
      /* ignore */
    }
  }

  const signOut = () => {
    setUser(null)
    setMenuOpen(false)
    setDrawerOpen(false)
    try {
      localStorage.removeItem(LS_USER)
    } catch {
      /* ignore */
    }
  }

  const navigate = (v, statusFilter) => {
    if (statusFilter) setFilter(statusFilter)
    else setFilter('All')
    setView(v)
    setDrawerOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addQuote = (data, status = 'Sent') => {
    const quote = {
      id: Date.now(),
      client: data.client,
      company: data.company,
      email: data.email,
      phone: data.phone || '',
      service: data.service,
      value: Number(data.value) || 0,
      sent: '17 Aug 2026',
      followUp: status === 'Booked' ? 'Completed' : status === 'Lost' ? 'Closed' : 'Today',
      status,
    }
    setQuotes((all) => [quote, ...all])
    setModal(null)
    setToast('New quotation added to your pipeline.')
  }

  const moveQuote = (id, status) => {
    setQuotes((all) =>
      all.map((q) =>
        q.id === id
          ? { ...q, status, followUp: status === 'Booked' ? 'Completed' : status === 'Lost' ? 'Closed' : q.followUp }
          : q,
      ),
    )
    setToast(`Moved to ${STATUS_META[status].label}.`)
  }

  const deleteQuote = (id) => {
    setQuotes((all) => all.filter((q) => q.id !== id))
    setModal(null)
    setToast('Quotation deleted.')
  }

  const sendFollowUp = (quote) => {
    setQuotes((all) => all.map((q) => (q.id === quote.id ? { ...q, status: 'Followed Up', followUp: '23 Aug' } : q)))
    setModal(null)
    setToast(`Follow-up prepared for ${quote.client}. Connect your sending API in Settings to deliver it.`)
  }

  if (!user) {
    return <Auth onAuth={signIn} />
  }

  return (
    <div className="app">
      <div
        className={`drawer-scrim ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`sidebar-wrap ${drawerOpen ? 'open' : ''}`}>
        <button className="icon-btn drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
          <Dismiss24Regular />
        </button>
        <Sidebar
          view={view}
          onNavigate={navigate}
          counts={counts}
          user={user}
          onSignOut={signOut}
        />
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn hamburger" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <span />
              <span />
              <span />
            </button>
            <span className="topbar-crumb">Quotely <span>/</span> {VIEW_TITLES[view]}</span>
          </div>
          <div className="topbar-right">
            <button className="btn btn-primary btn-new" onClick={() => setModal({ type: 'new' })}>
              <Add24Regular />
              <span>New quotation</span>
            </button>
            <div className="profile-menu">
              <button className="profile-btn" onClick={() => setMenuOpen((v) => !v)}>
                <Avatar name={user.business} className="avatar-side" />
                <span className="profile-btn-text">
                  <strong>{user.business}</strong>
                  <small>{user.name}</small>
                </span>
                <ChevronDown24Regular />
              </button>
              {menuOpen && (
                <div className="menu-pop menu-pop-profile">
                  <div className="menu-head">
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </div>
                  <button onClick={() => { setMenuOpen(false); navigate('settings') }}>
                    Settings
                  </button>
                  <button className="menu-danger" onClick={signOut}>
                    <SignOut24Regular />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content">
          {view === 'overview' && (
            <Dashboard
              quotes={quotes}
              user={user}
              onNewQuote={() => setModal({ type: 'new' })}
              onOpenQuote={(q) => setModal({ type: 'detail', quote: q })}
              onNavigate={navigate}
            />
          )}
          {view === 'quotations' && (
            <Quotations
              quotes={quotes}
              initialFilter={filter}
              onNewQuote={() => setModal({ type: 'new' })}
              onOpenQuote={(q) => setModal({ type: 'detail', quote: q })}
            />
          )}
          {view === 'board' && (
            <Kanban
              quotes={quotes}
              onMove={moveQuote}
              onOpenQuote={(q) => setModal({ type: 'detail', quote: q })}
              onNewQuote={(status) => setModal({ type: 'new', status: status || 'Sent' })}
            />
          )}
          {view === 'followups' && (
            <FollowUps
              quotes={quotes}
              onOpenQuote={(q) => setModal({ type: 'detail', quote: q })}
              onFollowUp={(q) => setModal({ type: 'followup', quote: q })}
            />
          )}
          {view === 'settings' && <Settings user={user} onSaved={setToast} />}
        </main>
      </div>

      {modal?.type === 'new' && (
        <NewQuoteModal
          defaultStatus={modal.status || 'Sent'}
          onClose={() => setModal(null)}
          onSubmit={addQuote}
        />
      )}
      {modal?.type === 'detail' && (
        <QuoteDetailModal
          quote={modal.quote}
          onClose={() => setModal(null)}
          onStatus={moveQuote}
          onFollowUp={(q) => setModal({ type: 'followup', quote: q })}
          onDelete={deleteQuote}
        />
      )}
      {modal?.type === 'followup' && (
        <FollowUpModal quote={modal.quote} business={user.business} onClose={() => setModal(null)} onSend={sendFollowUp} />
      )}

      {toast && (
        <div className="toast">
          <CheckmarkCircle24Regular />
          <span>{toast}</span>
          <button className="icon-btn icon-btn-sm" onClick={() => setToast('')} aria-label="Dismiss">
            <Dismiss24Regular />
          </button>
        </div>
      )}
    </div>
  )
}

function NewQuoteModal({ defaultStatus, onClose, onSubmit }) {
  const submit = (e) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    onSubmit(data, data.status || defaultStatus)
  }
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="New quotation"
      title="Add a quotation"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="new-quote-form" type="submit">
            Save quotation
          </button>
        </>
      }
    >
      <form id="new-quote-form" className="form-grid" onSubmit={submit}>
        <Field label="Client name">
          <input name="client" required placeholder="Amina Bello" />
        </Field>
        <Field label="Company">
          <input name="company" required placeholder="BrightPath Events" />
        </Field>
        <Field label="Email address">
          <input name="email" type="email" required placeholder="client@company.com" />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" placeholder="+234 800 000 0000" />
        </Field>
        <Field label="Service">
          <input name="service" required placeholder="Event furniture hire" />
        </Field>
        <Field label="Quote value (NGN)">
          <input name="value" type="number" min="0" required placeholder="500000" />
        </Field>
        <Field label="Stage">
          <select name="status" defaultValue={defaultStatus}>
            {STAGES.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  )
}

function QuoteDetailModal({ quote, onClose, onStatus, onFollowUp, onDelete }) {
  const won = quote.status === 'Booked'
  const lost = quote.status === 'Lost'
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Quotation"
      title={quote.client}
      size="lg"
      footer={
        <>
          <button className="btn btn-danger btn-ghost" onClick={() => onDelete(quote.id)}>
            <Delete24Regular />
            Delete
          </button>
          <span className="spacer" />
          {!lost && !won && (
            <>
              <button className="btn btn-ghost" onClick={() => onFollowUp(quote)}>
                <Mail24Regular />
                Follow up
              </button>
              <button className="btn btn-outline" onClick={() => onStatus(quote.id, 'Lost')}>
                Mark lost
              </button>
            </>
          )}
          {!won && (
            <button className="btn btn-primary" onClick={() => onStatus(quote.id, 'Booked')}>
              Mark booked
            </button>
          )}
        </>
      }
    >
      <div className="detail">
        <div className="detail-head">
          <Avatar name={quote.client} className="avatar-lg" />
          <div>
            <StatusPill status={quote.status} />
            <p>{quote.company}</p>
          </div>
          <span className="detail-value">{money.format(quote.value)}</span>
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <span>Service</span>
            <strong>{quote.service}</strong>
          </div>
          <div className="detail-item">
            <span>Sent</span>
            <strong>{quote.sent}</strong>
          </div>
          <div className="detail-item">
            <span>Follow-up</span>
            <strong className={quote.followUp === 'Overdue' ? 'overdue-text' : ''}>{quote.followUp}</strong>
          </div>
          <div className="detail-item">
            <span>Email</span>
            <strong className="detail-contact"><Mail24Regular />{quote.email}</strong>
          </div>
          {quote.phone && (
            <div className="detail-item">
              <span>Phone</span>
              <strong className="detail-contact"><Phone24Regular />{quote.phone}</strong>
            </div>
          )}
          <div className="detail-item">
            <span>Stage</span>
            <strong>{STATUS_META[quote.status].label}</strong>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function FollowUpModal({ quote, business, onClose, onSend }) {
  const subject = `Following up on your ${quote.service.toLowerCase()}`
  const message = `Hello ${quote.client.split(' ')[0]},\n\nI wanted to follow up on the quotation I sent for ${quote.service}. Please let me know if you have any questions or would like to proceed.\n\nKind regards,\n${business}`
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Follow-up"
      title={`Follow up with ${quote.client}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSend(quote)}>
            <Send24Regular />
            Prepare follow-up
          </button>
        </>
      }
    >
      <div className="followup-form">
        <div className="recipient">
          <span className="recipient-icon"><Mail24Regular /></span>
          <div>
            <span>To</span>
            <strong>{quote.email}</strong>
          </div>
        </div>
        <Field label="Subject">
          <input defaultValue={subject} />
        </Field>
        <Field label="Message">
          <textarea rows={7} defaultValue={message} />
        </Field>
        <p className="followup-note">Sent via your configured email API once connected in Settings.</p>
      </div>
    </Modal>
  )
}
