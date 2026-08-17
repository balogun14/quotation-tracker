import { useState } from 'react'
import { Building24Regular, Key24Regular, Mail24Regular, Person24Regular, Send24Regular } from '@fluentui/react-icons'
import { Field } from '../ui.jsx'

export function Settings({ user, onSaved }) {
  const [saved, setSaved] = useState(false)

  const save = (e) => {
    e.preventDefault()
    setSaved(true)
    onSaved('Settings saved for this session.')
    setTimeout(() => setSaved(false), 2500)
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

      <div className="settings-grid">
        <form className="panel settings-panel" onSubmit={save}>
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
              <input defaultValue={user?.business} />
            </Field>
            <Field label="Owner name">
              <input defaultValue={user?.name} />
            </Field>
            <Field label="Email address">
              <span className="input-wrap">
                <Mail24Regular className="input-icon" />
                <input type="email" defaultValue={user?.email} />
              </span>
            </Field>
            <Field label="Phone number">
              <span className="input-wrap">
                <Person24Regular className="input-icon" />
                <input type="tel" defaultValue="+234 800 000 0000" />
              </span>
            </Field>
          </div>
          <div className="panel-foot">
            <span className="foot-note">Profile saved locally for this demo.</span>
            <button className="btn btn-primary" type="submit" disabled={saved}>
              {saved ? 'Saved' : 'Save profile'}
            </button>
          </div>
        </form>

        <form className="panel settings-panel" onSubmit={save}>
          <div className="panel-head">
            <div>
              <h2>Email delivery</h2>
              <p>Connect your provider to send follow-ups from Quotely.</p>
            </div>
            <span className="settings-icon">
              <Send24Regular />
            </span>
          </div>
          <div className="form-grid">
            <Field label="Sending API endpoint">
              <input placeholder="https://api.your-provider.com/send" />
            </Field>
            <Field label="From email">
              <span className="input-wrap">
                <Mail24Regular className="input-icon" />
                <input type="email" placeholder="hello@yourbusiness.com" />
              </span>
            </Field>
            <Field label="API key" hint="Stored securely on your server — never exposed in the browser.">
              <span className="input-wrap">
                <Key24Regular className="input-icon" />
                <input type="password" placeholder="Paste your API key here" />
              </span>
            </Field>
          </div>
          <div className="panel-foot">
            <span className="foot-note">Demo only — keys are not persisted.</span>
            <button className="btn btn-primary" type="submit" disabled={saved}>
              {saved ? 'Saved' : 'Save settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
