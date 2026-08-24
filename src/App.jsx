import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Add24Regular,
  CheckmarkCircle24Regular,
  ChevronDown24Regular,
  Delete24Regular,
  Dismiss24Regular,
  Link24Regular,
  Mail24Regular,
  Phone24Regular,
  Send24Regular,
  SignOut24Regular,
} from '@fluentui/react-icons'
import './App.css'
import { money, STATUS_META } from './adapt.js'
import { Avatar, Field, Modal, StatusPill } from './ui.jsx'
import { Sidebar } from './components/Sidebar.jsx'
import { Auth } from './views/Auth.jsx'
import { Dashboard } from './views/Dashboard.jsx'
import { Quotations } from './views/Quotations.jsx'
import { FollowUps } from './views/FollowUps.jsx'
import { Kanban } from './views/Kanban.jsx'
import { Settings } from './views/Settings.jsx'
import { api, restoreSession, setAccessToken, signOut as apiSignOut } from './api.js'
import { quoteToUi, workspaceToUi } from './adapt.js'

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
  const [workspace, setWorkspace] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [view, setView] = useState('overview')
  const [filter, setFilter] = useState('All')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const userId = user?.id

  // Boot: if we have a stored user, try to restore the session (cookie refresh).
  const [booted, setBooted] = useState(!user)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const ok = await restoreSession()
        if (!cancelled && !ok) {
          // Cookie expired or no session — drop the stored user.
          try {
            localStorage.removeItem(LS_USER)
          } catch {
            /* ignore */
          }
          setUser(null)
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setBooted(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3600)
    return () => clearTimeout(t)
  }, [toast])

  // Load workspace + quotes once authenticated.
  useEffect(() => {
    if (!userId || !booted) return
    let cancelled = false
    setBusy(true)
    setError('')
    ;(async () => {
      try {
        const list = await api('/workspaces')
        const ws = list.items?.[0]
        if (!ws) throw new Error('No workspace found for this account.')
        const wsData = workspaceToUi(ws)
        if (!cancelled) setWorkspace(wsData)
        const me = await api('/account/me').catch(() => null)
        if (me && !cancelled) {
          setUser((u) => {
            const next = { ...u, name: me.name, email: me.email, emailVerified: Boolean(me.emailVerifiedAt) }
            try {
              localStorage.setItem(LS_USER, JSON.stringify(next))
            } catch {
              /* ignore */
            }
            return next
          })
        }
        const page = await api(`/workspaces/${ws.id}/quotes?limit=100`)
        const ui = (page.items || []).map(quoteToUi)
        if (!cancelled) setQuotes(ui)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load your workspace.')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  // Account details are refreshed during bootstrap. Depend on the stable ID, not
  // the user object, so that refresh cannot restart bootstrap indefinitely.
  }, [userId, booted])

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

  const signOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    await apiSignOut().catch(() => {})
    setAccessToken('')
    setUser(null)
    setWorkspace(null)
    setQuotes([])
    setMenuOpen(false)
    setDrawerOpen(false)
    try {
      localStorage.removeItem(LS_USER)
    } catch {
      /* ignore */
    }
    setSigningOut(false)
  }

  const navigate = (v, statusFilter) => {
    if (statusFilter) setFilter(statusFilter)
    else setFilter('All')
    setView(v)
    setDrawerOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const refreshQuotes = async () => {
    if (!workspace) return
    const page = await api(`/workspaces/${workspace.id}/quotes?limit=100`)
    setQuotes((page.items || []).map(quoteToUi))
  }

  // --- Actions ---

  const createQuote = async (data) => {
    if (!workspace) return
    const items = data.items.map((item, index) => {
      const quantity = Number(item.quantity)
      const unitPrice = Number(item.unitPrice)
      if (!item.description.trim()) throw new Error(`Line item ${index + 1} needs a description.`)
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error(`Line item ${index + 1} needs a whole-number quantity of at least 1.`)
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`Line item ${index + 1} needs a valid unit price.`)
      return {
        description: item.description.trim(),
        quantity,
        unitPriceMinor: Math.round(unitPrice * 100),
      }
    })
    const payload = {
      clientName: data.client,
      clientCompany: data.company,
      clientEmail: data.email,
      clientPhone: data.phone || undefined,
      serviceDescription: data.service,
      currency: workspace.defaultCurrency || 'NGN',
      items,
      ...(data.expiry ? { expiryDate: data.expiry } : {}),
    }
    await api(`/workspaces/${workspace.id}/quotes`, { method: 'POST', body: payload })
    await refreshQuotes()
    setModal(null)
    setToast('New quotation added to your pipeline.')
  }

  const sendQuote = async (quote) => {
    if (!workspace) return
    const raw = quote._raw || quote
    const res = await api(`/workspaces/${workspace.id}/quotes/${raw.id}/send`, { method: 'POST' })
    const link = res?.result?.publicUrl
    const emailDelivered = res?.result?.emailDelivered
    await refreshQuotes()
    setModal(null)
    setToast(emailDelivered === false ? `Quote saved, but its email could not be delivered. Share this link: ${link}` : link ? `Quote sent — public link: ${link}` : 'Quote sent.')
  }

  const moveQuote = async (id, stage) => {
    if (!workspace) return
    const quote = quotes.find((q) => q.id === id)
    const raw = quote?._raw || quote
    if (!raw) return
    const statuses = { Sent: 'sent', 'Followed Up': 'followed_up', Booked: 'accepted', Lost: 'declined' }
    await api(`/workspaces/${workspace.id}/quotes/${raw.id}/status`, { method: 'POST', body: { status: statuses[stage] } })
    await refreshQuotes()
    setToast(`Moved to ${STATUS_META[stage].label}.`)
  }

  const draftInput = (quote) => ({
    clientName: quote.clientName ?? quote.client,
    clientCompany: quote.clientCompany ?? quote.company,
    clientEmail: quote.clientEmail ?? quote.email,
    clientPhone: quote.clientPhone ?? quote.phone,
    serviceDescription: quote.serviceDescription ?? quote.service,
    currency: quote.currency,
    items: quote.items && quote.items.length
      ? quote.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPriceMinor: i.unitPriceMinor }))
      : [{ description: quote.service ?? quote.serviceDescription, quantity: 1, unitPriceMinor: Math.round((quote.value || 0) * 100) }],
    expiryDate: quote.expiryDate ?? undefined,
    followUpMode: quote.followUpMode ?? 'reminder',
  })

  const deleteQuote = async (quote) => {
    if (!workspace) return
    const raw = quote._raw || quote
    await api(`/workspaces/${workspace.id}/quotes/${raw.id}`, { method: 'DELETE' })
    await refreshQuotes()
    setModal(null)
    setToast('Quotation cancelled.')
  }

  const sendFollowUp = async (quote, input) => {
    if (!workspace) return
    const raw = quote._raw || quote
    const res = await api(`/workspaces/${workspace.id}/quotes/${raw.id}/follow-up`, { method: 'POST', body: input })
    await refreshQuotes()
    setModal(null)
    setToast(res?.result?.emailDelivered === false ? `Follow-up saved, but the email could not be delivered.` : `Follow-up sent to ${quote.client}.`)
  }

  const revokeLinks = async (quote) => {
    if (!workspace) return
    const raw = quote._raw || quote
    const res = await api(`/workspaces/${workspace.id}/quotes/${raw.id}/revoke-links`, { method: 'POST' })
    setToast(`Revoked ${res?.revoked ?? 0} public link(s).`)
  }

  const updateBranding = async (input) => {
    if (!workspace) return
    const res = await api(`/workspaces/${workspace.id}/branding`, { method: 'PATCH', body: input })
    setWorkspace(workspaceToUi(res.workspace))
    return res.workspace
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
          signingOut={signingOut}
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
                  <button className="menu-danger" onClick={signOut} disabled={signingOut}>
                    <SignOut24Regular />
                    {signingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content">
          {busy && !quotes.length && <div className="page-loading">Loading your workspace…</div>}
          {!busy && error && <div className="page-error">{error}</div>}

          {!busy && !error && view === 'overview' && (
            <Dashboard
              quotes={quotes}
              user={user}
              onNewQuote={() => setModal({ type: 'new' })}
              onOpenQuote={(q) => setModal({ type: 'detail', quote: q })}
              onNavigate={navigate}
            />
          )}
          {!busy && !error && view === 'quotations' && (
            <Quotations
              quotes={quotes}
              initialFilter={filter}
              onNewQuote={() => setModal({ type: 'new' })}
              onOpenQuote={(q) => setModal({ type: 'detail', quote: q })}
            />
          )}
          {!busy && !error && view === 'board' && (
            <Kanban
              quotes={quotes}
              onMove={moveQuote}
              onOpenQuote={(q) => setModal({ type: 'detail', quote: q })}
              onNewQuote={(status) => setModal({ type: 'new', status: status || 'Sent' })}
            />
          )}
          {!busy && !error && view === 'followups' && (
            <FollowUps
              quotes={quotes}
              onOpenQuote={(q) => setModal({ type: 'detail', quote: q })}
              onFollowUp={(q) => setModal({ type: 'followup', quote: q })}
            />
          )}
          {!busy && !error && view === 'settings' && (
            <Settings
              user={user}
              workspace={workspace}
              onSaved={setToast}
              onUpdateBranding={updateBranding}
            />
          )}
        </main>
      </div>

      {modal?.type === 'new' && (
        <NewQuoteModal
          currency={workspace?.defaultCurrency || 'NGN'}
          onClose={() => setModal(null)}
          onSubmit={createQuote}
        />
      )}
      {modal?.type === 'detail' && (
        <QuoteDetailModal
          quote={modal.quote}
          onClose={() => setModal(null)}
          onFollowUp={(q) => setModal({ type: 'followup', quote: q })}
          onDelete={deleteQuote}
          onSend={sendQuote}
          onRevokeLinks={revokeLinks}
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

function NewQuoteModal({ currency, onClose, onSubmit }) {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [items, setItems] = useState([{ description: '', quantity: 1, unitPrice: '' }])
  const submittingRef = useRef(false)

  const submit = async (e) => {
    e.preventDefault()
    // State updates are asynchronous; the ref closes the tiny window in which
    // a second click can arrive before the button is rerendered as disabled.
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setSubmitError('')
    const data = Object.fromEntries(new FormData(e.currentTarget))
    try {
      await onSubmit({ ...data, items })
    } catch (err) {
      const details = err?.details && typeof err.details === 'object'
        ? Object.values(err.details).flat().filter(Boolean).join(' ')
        : ''
      setSubmitError(details || err.message || 'Could not save the quotation. Please try again.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="New quotation"
      title="Add a quotation"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" form="new-quote-form" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save quotation'}
          </button>
        </>
      }
    >
      {submitError && <div className="form-error">{submitError}</div>}
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
        <div className="field line-items form-field-wide">
          <div className="line-items-heading">
            <label>Line items</label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItems((current) => [...current, { description: '', quantity: 1, unitPrice: '' }])}>Add item</button>
          </div>
          {items.map((item, index) => (
            <div className="line-item-row" key={index}>
              <input aria-label={`Item ${index + 1} description`} value={item.description} required placeholder="Item description" onChange={(e) => setItems((current) => current.map((entry, i) => i === index ? { ...entry, description: e.target.value } : entry))} />
              <input aria-label={`Item ${index + 1} quantity`} value={item.quantity} type="number" min="1" step="1" required onChange={(e) => setItems((current) => current.map((entry, i) => i === index ? { ...entry, quantity: e.target.value } : entry))} />
              <input aria-label={`Item ${index + 1} unit price in ${currency}`} value={item.unitPrice} type="number" min="0" step="0.01" required placeholder={`Unit price (${currency})`} onChange={(e) => setItems((current) => current.map((entry, i) => i === index ? { ...entry, unitPrice: e.target.value } : entry))} />
              {items.length > 1 && <button type="button" className="icon-btn" aria-label={`Remove item ${index + 1}`} onClick={() => setItems((current) => current.filter((_, i) => i !== index))}><Dismiss24Regular /></button>}
            </div>
          ))}
        </div>
        <Field label="Expiry date (optional)">
          <input name="expiry" type="date" />
        </Field>
      </form>
    </Modal>
  )
}

function QuoteDetailModal({ quote, onClose, onFollowUp, onDelete, onSend, onRevokeLinks }) {
  const draft = quote.status === 'Draft'
  const sendable = draft || quote.status === 'Sent' || quote.status === 'Followed Up'
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Quotation"
      title={quote.client}
      size="lg"
      footer={
        <>
          <button className="btn btn-danger btn-ghost" onClick={() => onDelete(quote)}>
            <Delete24Regular />
            {draft ? 'Cancel' : 'Cancel quote'}
          </button>
          <span className="spacer" />
          {sendable && (
            <>
              <button className="btn btn-ghost" onClick={() => onFollowUp(quote)}>
                <Mail24Regular />
                Follow up
              </button>
              <button className="btn btn-primary" onClick={() => onSend(quote)}>
                <Send24Regular />
                {draft ? 'Send quote' : 'Re-send'}
              </button>
            </>
          )}
          {!draft && (
            <button className="btn btn-outline" onClick={() => onRevokeLinks(quote)}>
              <Link24Regular />
              Revoke links
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
          <span className="detail-value">{money.format(quote.value, quote.currency)}</span>
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
            <strong>{STATUS_META[quote.status]?.label || quote.status}</strong>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function FollowUpModal({ quote, business, onClose, onSend }) {
  const [subject, setSubject] = useState(`Following up on your ${quote.service.toLowerCase()}`)
  const [message, setMessage] = useState(`Hello ${quote.client.split(' ')[0]},\n\nI wanted to follow up on the quotation I sent for ${quote.service}. Please let me know if you have any questions or would like to proceed.\n\nKind regards,\n${business}`)
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Follow-up"
      title={`Follow up with ${quote.client}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSend(quote, { subject, message })}>
            <Send24Regular />
            Send follow-up
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
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Message">
          <textarea rows={7} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <p className="followup-note">A follow-up email is queued and delivered by the Quotely worker.</p>
      </div>
    </Modal>
  )
}
