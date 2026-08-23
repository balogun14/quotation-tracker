import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { PublicQuote } from './views/PublicQuote.jsx'

const token = window.location.pathname.match(/^\/p\/([^/]+)\/?$/)?.[1]

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {token ? <PublicQuote token={token} /> : <App />}
  </StrictMode>,
)
