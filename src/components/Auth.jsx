import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Sign in / sign up screen.
//
// Everything here goes through supabase.auth, which issues a JWT and stores
// it in the browser. Every later .from('expenses').select() carries that
// token, and the database reads auth.uid() out of it to decide which rows
// you are allowed to see. The filtering is not done in this file — it is
// done by the RLS policies in supabase/schema.sql.
export default function Auth() {
  const [mode, setMode] = useState('signin')      // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')

    const fn = mode === 'signin' ? 'signInWithPassword' : 'signUp'
    const { data, error } = await supabase.auth[fn]({ email, password })

    if (error) {
      setError(error.message)
    } else if (mode === 'signup' && !data.session) {
      // Supabase is configured to require email confirmation.
      setNotice('Check your email for a confirmation link, then sign in.')
    }
    setBusy(false)
  }

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <div className="eyebrow">Planned vs actual</div>
          <h1>Spend Tracker</h1>
        </div>
      </header>

      <div className="card auth-card">
        <h2>{mode === 'signin' ? 'Sign in' : 'Create an account'}</h2>
        <p className="hint">
          Your budgets and expenses are private to your account. The database
          enforces that, not the browser.
        </p>

        <form onSubmit={submit} className="auth-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </label>

          {error &&  <div className="error">{error}</div>}
          {notice && <div className="notice">{notice}</div>}

          <button type="submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <p className="hint" style={{ marginTop: 14 }}>
          {mode === 'signin' ? "No account yet? " : 'Already have one? '}
          <button
            className="link"
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice('') }}
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
