import { useState } from 'react'
import { ArrowRight24Regular, Checkmark24Regular, Eye24Regular, EyeOff24Regular, LockClosed24Regular, Mail24Regular, Person24Regular, Sparkle24Regular } from '@fluentui/react-icons'

const perks = [
  'Track every quotation from quote to booking',
  'Automated follow-up reminders before leads go cold',
  'A clear board view of your whole pipeline',
]

export function Auth({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const name = data.get('name') || ''
    const email = String(data.get('email') || '').trim()
    const password = String(data.get('password') || '')
    const business = data.get('business') || ''

    if (!email || !password) {
      setError('Please fill in your email and password.')
      return
    }
    if (mode === 'signup' && (!name || !business)) {
      setError('Please fill in every field to create your account.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError('')
    setTimeout(() => {
      onAuth({
        name: name || email.split('@')[0].replace(/[._]/g, ' '),
        email,
        business: business || 'Mum\'s Rentals',
      })
    }, 650)
  }

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'signup' : 'login'))
    setError('')
  }

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
            <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p>
              {mode === 'login' ? 'Sign in to your Quotely workspace.' : 'Start tracking your rental quotes in minutes.'}
            </p>
          </div>

          <div className="auth-tabs" role="tablist">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} role="tab">
              Sign in
            </button>
            <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')} role="tab">
              Create account
            </button>
          </div>

          {error && <div className="form-error">{error}</div>}

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
            <label className="field">
              <span className="field-label">Email address</span>
              <span className="input-wrap">
                <Mail24Regular className="input-icon" />
                <input name="email" type="email" placeholder="you@business.com" autoComplete="email" required />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <span className="input-wrap">
                <LockClosed24Regular className="input-icon" />
                <input name="password" type={showPass ? 'text' : 'password'} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
                <button type="button" className="input-action" onClick={() => setShowPass((v) => !v)} aria-label="Toggle password visibility">
                  {showPass ? <EyeOff24Regular /> : <Eye24Regular />}
                </button>
              </span>
            </label>

            {mode === 'login' && (
              <div className="auth-meta">
                <label className="check">
                  <input type="checkbox" defaultChecked />
                  <span>Remember me</span>
                </label>
                <button type="button" className="link-btn">
                  Forgot password?
                </button>
              </div>
            )}

            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              {!loading && <ArrowRight24Regular />}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button type="button" className="link-btn" onClick={switchMode}>
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
