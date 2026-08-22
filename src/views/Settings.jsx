import { useState } from 'react'
import { Building24Regular, Key24Regular, Mail24Regular, Person24Regular, Send24Regular } from '@fluentui/react-icons'
import { Field } from '../ui.jsx'
import { api } from '../api.js'

export function Settings({ user, workspace, onSaved, onUpdateBranding }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const saveBranding = async (e) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    setError('')
    setSaving(true)
    try {
      await onUpdateBranding({
        businessName: String(data.businessName || '').trim() || undefined,
        replyToEmail: String(data.replyToEmail || '').trim() || undefined,
        phone: String(data.phone || '').trim() || null,
        address: String(data.address || '').trim() || null,
        website: String(data.website || '').trim() || null,
        paymentInstructions: String(data.paymentInstructions || '').trim() || null,
        defaultCurrency: String(data.defaultCurrency || '').trim().toUpperCase() || undefined,
        accentColor: String(data.accentColor || '').trim() || undefined,
      })
      onSaved('Workspace profile saved.')
    } catch (err) {
      setError(err.message || 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  const sendVerify = async () => {
    setError('')
    try {
      await api('/account/verify-email', { method: 'POST' })
      onSaved('Verification email sent.')
    } catch (err) {
      setError(err.message || 'Could not send verification email.')
    }
  }

  return (
    <div className="view view-settings">
      <section className="view-head">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>Settings</h1>
          <p>Manage your workspace and email delivery.</p>
        </div>
      </section>

      {error && <div className="form-error">{error}</div>}

      <div className="settings-grid">
        <form className="panel settings-panel" onSubmit={saveBranding}>
          <div className="panel-head">
            <div>
              <h2>Business profile</h2>
              <p>These details appear on your quotations and emails.</p>
            </div>
            <span className="settings-icon">
              <Building24Regular />
            </span>
          </div>
          <div className="form-grid">
            <Field label="Business name">
              <input name="businessName" defaultValue={workspace?.businessName || user?.business} required />
            </Field>
            <Field label="Reply-to email">
              <span className="input-wrap">
                <Mail24Regular className="input-icon" />
                <input name="replyToEmail" type="email" defaultValue={workspace?.replyToEmail || user?.email} required />
              </span>
            </Field>
            <Field label="Phone number">
              <span className="input-wrap">
                <Person24Regular className="input-icon" />
                <input name="phone" type="tel" defaultValue={workspace?.phone || ''} />
              </span>
            </Field>
            <Field label="Address">
              <input name="address" defaultValue={workspace?.address || ''} />
            </Field>
            <Field label="Website">
              <input name="website" type="url" defaultValue={workspace?.website || ''} placeholder="https://…" />
            </Field>
            <Field label="Default currency">
              <input name="defaultCurrency" defaultValue={workspace?.defaultCurrency || 'NGN'} maxLength={3} placeholder="NGN" />
            </Field>
            <Field label="Accent colour">
              <input name="accentColor" type="color" defaultValue={workspace?.accentColor || '#8B5A2B'} />
            </Field>
            <Field label="Payment instructions">
              <textarea name="paymentInstructions" rows={2} defaultValue={workspace?.paymentInstructions || ''} />
            </Field>
          </div>
          <div className="panel-foot">
            <span className="foot-note">Saved to your workspace.</span>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>

        <div className="panel settings-panel">
          <div className="panel-head">
            <div>
              <h2>Account</h2>
              <p>Your sign-in details and email verification status.</p>
            </div>
            <span className="settings-icon">
              <Key24Regular />
            </span>
          </div>
          <div className="form-grid">
            <Field label="Name">
              <input defaultValue={user?.name} disabled />
            </Field>
            <Field label="Email address">
              <span className="input-wrap">
                <Mail24Regular className="input-icon" />
                <input defaultValue={user?.email} disabled />
              </span>
            </Field>
            <Field label="Email verification">
              <span className="input-wrap">
                <Send24Regular className="input-icon" />
                <input
                  defaultValue={user?.emailVerified ? 'Verified' : 'Not verified'}
                  disabled
                />
              </span>
            </Field>
          </div>
          <div className="panel-foot">
            <span className="foot-note">Verify your email to unlock sensitive actions.</span>
            <button className="btn btn-outline" type="button" onClick={sendVerify} disabled={user?.emailVerified}>
              {user?.emailVerified ? 'Verified' : 'Send verification email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
