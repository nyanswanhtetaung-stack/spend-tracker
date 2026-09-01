import { useEffect, useMemo, useState } from 'react'
import { supabase, isConfigured, monthKey, formatMonth, money } from './lib/supabase'
import { analyseMonth } from './lib/analyse'
import VarianceTable from './components/VarianceTable'
import BudgetForm from './components/BudgetForm'
import ExpenseForm from './components/ExpenseForm'
import Findings from './components/Findings'
import Auth from './components/Auth'

export default function App() {
  const [month, setMonth] = useState(monthKey())
  const [months, setMonths] = useState([monthKey()])
  const [rows, setRows] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [session, setSession] = useState(undefined)   // undefined = still checking

  // ---- Who is signed in --------------------------------------------
  // getSession() reads the token already saved in this browser, so a
  // refresh doesn't sign you out. onAuthStateChange keeps this in step
  // with sign-in and sign-out happening anywhere in the app.
  useEffect(() => {
    if (!isConfigured) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => setSession(next)
    )
    return () => listener.subscription.unsubscribe()
  }, [])

  // ---- Reading data ------------------------------------------------
  // This is the whole "backend". No API to write: .from('table').select()
  // becomes an HTTP request that Supabase turns into SQL for you.
  async function load(targetMonth) {
    if (!isConfigured) { setLoading(false); return }
    setLoading(true)
    setError('')

    const monthStart = targetMonth
    const nextMonth = addMonths(targetMonth, 1)

    const [varianceRes, expenseRes, monthRes] = await Promise.all([
      supabase
        .from('monthly_variance')          // <- the VIEW from schema.sql
        .select('*')
        .eq('month', monthStart)
        .order('variance', { ascending: false }),

      supabase
        .from('expenses')
        .select('*')
        .gte('spent_on', monthStart)       // gte / lt = SQL WHERE clauses
        .lt('spent_on', nextMonth)
        .order('spent_on', { ascending: true }),

      supabase
        .from('monthly_variance')
        .select('month'),
    ])

    const failure = varianceRes.error || expenseRes.error || monthRes.error
    if (failure) {
      setError(readableError(failure))
      setLoading(false)
      return
    }

    setRows(varianceRes.data ?? [])
    setExpenses(expenseRes.data ?? [])

    const unique = [...new Set((monthRes.data ?? []).map(r => r.month))].sort().reverse()
    setMonths(unique.length ? unique : [monthKey()])
    setLoading(false)
  }

  useEffect(() => { if (session) load(month) }, [month, session])

  const analysis = useMemo(() => analyseMonth(rows, expenses), [rows, expenses])

  // Categories offered in the dropdowns — whatever already exists, plus
  // whatever the person types in.
  const categories = useMemo(() => {
    const set = new Set(rows.map(r => r.category))
    return [...set].sort()
  }, [rows])

  if (!isConfigured) return <NotConfigured />
  if (session === undefined) return <Splash />
  if (!session) return <Auth />

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <div className="eyebrow">Planned vs actual</div>
          <h1>Company spending</h1>
        </div>
        <div className="toolbar">
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            aria-label="Choose month"
          >
            {months.map(m => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
          <button className="ghost" onClick={() => load(month)} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            className="ghost"
            onClick={() => supabase.auth.signOut()}
            title={session?.user?.email || ''}
          >
            Sign out
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="totals">
        <div className="total">
          <div className="label">Planned</div>
          <div className="value fig">{money(analysis.plannedTotal)}</div>
        </div>
        <div className="total">
          <div className="label">Actual</div>
          <div className="value fig">{money(analysis.actualTotal)}</div>
        </div>
        <div className="total">
          <div className="label">{analysis.variance > 0 ? 'Over by' : 'Under by'}</div>
          <div className={`value fig ${analysis.variance > 0 ? 'over' : 'under'}`}>
            {money(Math.abs(analysis.variance))}
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="card">
        <h2>{formatMonth(month)} by category</h2>
        <p className="hint">
          The bar runs left when a category came in under plan and right when it went over.
        </p>
        <VarianceTable rows={rows} loading={loading} />
      </div>

      <Findings analysis={analysis} month={month} expenses={expenses} />

      <div className="grid two" style={{ marginTop: 16 }}>
        <BudgetForm
          month={month}
          categories={categories}
          onSaved={() => load(month)}
          setError={setError}
        />
        <ExpenseForm
          month={month}
          categories={categories}
          onSaved={() => load(month)}
          setError={setError}
        />
      </div>

      <div className="card">
        <h2>Every expense this month</h2>
        <p className="hint">{expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}</p>
        {expenses.length === 0 ? (
          <div className="empty">Nothing recorded yet. Add the first expense above.</div>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Note</th>
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}>
                  <td className="fig">{e.spent_on}</td>
                  <td>{e.category}</td>
                  <td style={{ color: 'var(--ink-soft)' }}>{e.note || '—'}</td>
                  <td className="num fig">{money(e.amount)}</td>
                  <td className="num">
                    <button
                      className="link"
                      onClick={() => removeExpense(e.id, () => load(month), setError)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ---- Writing data --------------------------------------------------
async function removeExpense(id, onDone, setError) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) setError(readableError(error))
  else onDone()
}

// ---- Helpers -------------------------------------------------------
function addMonths(iso, n) {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function readableError(err) {
  if (err.code === '42P01') {
    return 'That table does not exist yet. Run supabase/schema.sql in the Supabase SQL Editor.'
  }
  if (err.code === '42501' || /row-level security/i.test(err.message || '')) {
    return 'The database refused that request — Row Level Security is blocking it. ' +
           'Check the policies in schema.sql section 4.'
  }
  return err.message || 'Something went wrong talking to the database.'
}

function Splash() {
  return (
    <div className="app">
      <div className="card"><p className="hint">Checking your session…</p></div>
    </div>
  )
}

function NotConfigured() {
  return (
    <div className="app">
      <header className="masthead">
        <div>
          <div className="eyebrow">Setup needed</div>
          <h1>Spend Tracker</h1>
        </div>
      </header>
      <div className="card">
        <h2>Connect your Supabase project</h2>
        <p className="hint">Two values, then this page fills itself in.</p>
        <ol style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
          <li>Create a project at supabase.com</li>
          <li>Open the SQL Editor and run <code>supabase/schema.sql</code></li>
          <li>Go to Project Settings → API and copy the URL and anon key</li>
          <li>Copy <code>.env.example</code> to <code>.env</code> and paste them in</li>
          <li>Restart the dev server (<code>npm run dev</code>)</li>
        </ol>
      </div>
    </div>
  )
}
