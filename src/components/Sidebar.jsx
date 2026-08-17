import { ArrowTrending24Regular, Board24Regular, Mail24Regular, Receipt24Regular, Settings24Regular, SignOut24Regular } from '@fluentui/react-icons'

const NAV = [
  { id: 'overview', label: 'Overview', icon: ArrowTrending24Regular },
  { id: 'quotations', label: 'Quotations', icon: Receipt24Regular },
  { id: 'board', label: 'Board', icon: Board24Regular },
  { id: 'followups', label: 'Follow-ups', icon: Mail24Regular },
]

export function Sidebar({ view, onNavigate, counts, user, onSignOut }) {
  const navWithBadge = NAV.map((n) => ({ ...n, badge: counts[n.id] }))
  return (
    <div className="sidebar">
      <div className="brand">
        <span className="brand-mark">Q</span>
        <span>Quotely</span>
      </div>

      <nav className="side-nav">
        <span className="side-label">Workspace</span>
        {navWithBadge.map((n) => {
          const Icon = n.icon
          return (
            <button
              key={n.id}
              className={`side-item ${view === n.id ? 'active' : ''}`}
              onClick={() => onNavigate(n.id)}
            >
              <Icon />
              <span>{n.label}</span>
              {n.badge > 0 && <em className="side-badge">{n.badge}</em>}
            </button>
          )
        })}
        <span className="side-label side-label-gap">Manage</span>
        <button
          className={`side-item ${view === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <Settings24Regular />
          <span>Settings</span>
        </button>
      </nav>

      <div className="side-bottom">
        <div className="side-profile">
          <span className="avatar avatar-side">{user.business.charAt(0).toUpperCase()}</span>
          <div className="side-profile-text">
            <strong>{user.business}</strong>
            <small>{user.email}</small>
          </div>
          <button className="icon-btn side-signout" onClick={onSignOut} aria-label="Sign out" title="Sign out">
            <SignOut24Regular />
          </button>
        </div>
      </div>
    </div>
  )
}
