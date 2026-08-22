import { useState } from 'react'
import { ArrowRight24Regular, Checkmark24Regular, Eye24Regular, EyeOff24Regular, LockClosed24Regular, Mail24Regular, Person24Regular, Sparkle24Regular } from '@fluentui/react-icons'
import { signIn, signUp, api } from '../api.js'

const perks = [
  'Track every quotation from quote to booking',
  'Automated follow-up reminders before leads go cold',
  'A clear board view of your whole pipeline',
]

export function Auth({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'reset' | 'verify'
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const name = data.get('name') || ''
    const email = String(data.get('email') || '').trim()
    const password = String(data.get('password') || '')
    const business = data.get('business') || ''

    setError('')
    setNotice('')

    if (mode === 'login') {
      if (!email || !password) return setError('Please fill in your email and password.')
      setLoading(true)
      try {
        const result = await signIn(email, password)
        onAuth({
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          business: result.workspace.businessName,
          workspaceId: result.workspace.id,
          emailVerified: Boolean(result.user.emailVerifiedAt),
        })
      } catch (err) {
        setError(err.message || 'Sign in failed.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (mode === 'signup') {
      if (!name || !business) return setError('Please fill in every field to create your account.')
      if (!email || !password) return setError('Please fill in your email and password.')
      if (password.length < 8) return setError('Password must be at least 8 characters.')
      setLoading(true)
      try {
        const result = await signUp({ name, email, password, businessName: business })
        onAuth({
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          business: result.workspace.businessName,
          workspaceId: result.workspace.id,
          emailVerified: false,
        })
      } catch (err) {
        setError(err.message || 'Could not create your account.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (mode === 'reset') {
      if (!email) return setError('Enter your email address.')
      setLoading(true)
      try {
        await api('/account/password-reset', { method: 'POST', body: { email } })
        setNotice('If that email has an account, a reset link is on its way.')
        e.currentTarget.reset()
      } catch (err) {
        setError(err.message || 'Could not request a reset.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (mode === 'verify') {
      const token = String(data.get('token') || '').trim()
      if (!token) return setError('Paste the link you received by email.')
      setLoading(true)
      try {
        await api('/account/verify-email/confirm', { method: 'POST', body: { token } })
        setNotice('Email verified. You can sign in now.')
        setMode('login')
      } catch (err) {
        setError(err.message || 'That link is invalid or expired.')
      } finally {
        setLoading(false)
      }
      return
    }
  }

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setNotice('')
  }

  const heading = mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Verify your email'
  const sub = mode === 'login'
    ? 'Sign in to your Quotely workspace.'
    : mode === 'signup'
      ? 'Start tracking your rental quotes in minutes.'
      : mode === 'reset'
        ? 'We will email you a link to set a new password.'
        : 'Enter the verification link from your email.'

  return (
    <div className="auth">
      <div className="auth-brand">
        <div className="brand">
          <span className="brand-mark">Q</span>
          <span>Quotely</span>
        </div>
        <div className="auth-pitch">
          <span className="eyebrow eyebrow-gold">Rental quote tracking</span>
          <h1>Never let a rental enquiry go cold.</h1>
          <p>Quotely keeps every quotation, follow-up and booking in one calm, organised place — built for busy rental businesses.</p>
          <ul className="auth-perks">
            {perks.map((p) => (
              <li key={p}>
                <span className="perk-check">
                  <Checkmark24Regular />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="auth-foot">© {new Date().getFullYear()} Quotely. Made for rental teams.</p>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-head">
            <h2>{heading}</h2>
            <p>{sub}</p>
          </div>

          {(mode === 'login' || mode === 'signup') && (
            <div className="auth-tabs" role="tablist">
              <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} role="tab">
                Sign in
              </button>
              <button className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')} role="tab">
                Create account
              </button>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}
          {notice && <div className="form-notice">{notice}</div>}

          <form className="auth-form" onSubmit={submit}>
            {mode === 'signup' && (
              <label className="field">
                <span className="field-label">Full name</span>
                <span className="input-wrap">
                  <Person24Regular className="input-icon" />
                  <input name="name" placeholder="Amina Bello" autoComplete="name" />
                </span>
              </label>
            )}
            {mode === 'signup' && (
              <label className="field">
                <span className="field-label">Business name</span>
                <span className="input-wrap">
                  <Sparkle24Regular className="input-icon" />
                  <input name="business" placeholder="Mum's Rentals" autoComplete="organization" />
                </span>
              </label>
            )}
            {mode === 'login' && (
              <label className="field">
                <span className="field-label">Email address</span>
                <span className="input-wrap">
                  <Mail24Regular className="input-icon" />
                  <input name="email" type="email" placeholder="you@business.com" autoComplete="email" required />
                </span>
              </label>
            )}
            {mode === 'signup' && (
              <label className="field">
                <span className="field-label">Email address</span>
                <span className="input-wrap">
                  <Mail24Regular className="input-icon" />
                  <input name="email" type="email" placeholder="you@business.com" autoComplete="email" required />
                </span>
              </label>
            )}
            {mode === 'reset' && (
              <label className="field">
                <span className="field-label">Email address</span>
                <span className="input-wrap">
                  <Mail24Regular className="input-icon" />
                  <input name="email" type="email" placeholder="you@business.com" autoComplete="email" required />
                </span>
              </label>
            )}
            {mode === 'verify' && (
              <label className="field">
                <span className="field-label">Verification link</span>
                <span className="input-wrap">
                  <Mail24Regular className="input-icon" />
                  <input name="token" placeholder="Paste the full link" required />
                </span>
              </label>
            )}
            {mode === 'login' && (
              <label className="field">
                <span className="field-label">Password</span>
                <span className="input-wrap">
                  <LockClosed24Regular className="input-icon" />
                  <input name="password" type={showPass ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password" required />
                  <button type="button" className="input-action" onClick={() => setShowPass((v) => !v)} aria-label="Toggle password visibility">
                    {showPass ? <EyeOff24Regular /> : <Eye24Regular />}
                  </button>
                </span>
              </label>
            )}
            {mode === 'signup' && (
              <label className="field">
                <span className="field-label">Password</span>
                <span className="input-wrap">
                  <LockClosed24Regular className="input-icon" />
                  <input name="password" type={showPass ? 'text' : 'password'} placeholder="At least 8 characters" autoComplete="new-password" required />
                  <button type="button" className="input-action" onClick={() => setShowPass((v) => !v)} aria-label="Toggle password visibility">
                    {showPass ? <EyeOff24Regular /> : <Eye24Regular />}
                  </button>
                </span>
              </label>
            )}

            {mode === 'login' && (
              <div className="auth-meta">
                <label className="check">
                  <input type="checkbox" defaultChecked />
                  <span>Remember me</span>
                </label>
                <button type="button" className="link-btn" onClick={() => switchMode('reset')}>
                  Forgot password?
                </button>
              </div>
            )}

            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Verify email'}
              {!loading && <ArrowRight24Regular />}
            </button>
          </form>

          {(mode === 'login' || mode === 'signup') && (
            <p className="auth-switch">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button type="button" className="link-btn" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          )}
          {mode === 'reset' && (
            <p className="auth-switch">
              Remembered it?{' '}
              <button type="button" className="link-btn" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </p>
          )}
          {mode === 'verify' && (
            <p className="auth-switch">
              Already verified?{' '}
              <button type="button" className="link-btn" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
