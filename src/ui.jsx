import { useEffect } from 'react'
import { Dismiss24Regular } from '@fluentui/react-icons'
import { initials, STATUS_META } from './data.js'

export function StatusPill({ status }) {
  const meta = STATUS_META[status] || { className: 'sent', label: status }
  return (
    <span className={`status-pill ${meta.className}`}>
      <span className="status-dot" />
      {meta.label}
    </span>
  )
}

export function Avatar({ name, className = '' }) {
  return <span className={`avatar ${className}`}>{initials(name || '?')}</span>
}

export function Modal({ open, onClose, title, eyebrow, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h3 className="modal-title">{title}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Dismiss24Regular />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <span className="empty-icon">
          <Icon />
        </span>
      )}
      <h4>{title}</h4>
      <p>{body}</p>
      {action}
    </div>
  )
}
