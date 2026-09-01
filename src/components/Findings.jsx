import { useState } from 'react'
import { supabase, formatMonth } from '../lib/supabase'

// Shows the month-end verdict: which categories broke the budget.
//
// The list below is computed locally from the numbers — instant, free, and
// always correct. The "Explain this" button is the optional extra: it sends
// the figures and the expense notes to Gemini through a Supabase Edge
// Function, which reads the notes and says something arithmetic can't.
export default function Findings({ analysis, month, expenses }) {
  const [narrative, setNarrative] = useState('')
  const [thinking, setThinking] = useState(false)
  const [aiError, setAiError] = useState('')

  async function explain() {
    setThinking(true); setAiError(''); setNarrative('')
    try {
      // Edge Functions are small server-side scripts. The Gemini key lives
      // in Supabase's secrets, never in this file — the same reasoning as
      // keeping an API key out of client-side JavaScript.
      const { data, error } = await supabase.functions.invoke('analyze', {
        body: {
          month: formatMonth(month),
          plannedTotal: analysis.plannedTotal,
          actualTotal: analysis.actualTotal,
          overspend: analysis.over.map(r => ({
            category: r.category,
            planned: Number(r.planned_amount),
            actual: Number(r.actual_amount),
            over: Number(r.variance),
          })),
          expenses: expenses.map(e => ({
            date: e.spent_on, category: e.category,
            amount: Number(e.amount), note: e.note,
          })),
        },
      })
      if (error) throw error
      setNarrative(data?.summary || 'No summary came back.')
    } catch (err) {
      setAiError(
        'Could not reach the analyze function. It is optional — deploy it with ' +
        '`supabase functions deploy analyze` (see README step 6).'
      )
      console.error(err)
    } finally {
      setThinking(false)
    }
  }

  if (!analysis.findings.length) return null

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>What happened</h2>
      <p className="hint">Worked out from the figures above.</p>

      {analysis.findings.map((f, i) => (
        <div key={i} className={`finding ${f.tone}`}>
          <h3>{f.title}</h3>
          <p>{f.detail}</p>
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        <button className="ghost" onClick={explain} disabled={thinking}>
          {thinking ? 'Reading the entries…' : 'Explain this in words'}
        </button>
      </div>

      {aiError && <p className="hint" style={{ marginTop: 10 }}>{aiError}</p>}

      {narrative && (
        <div className="finding" style={{ marginTop: 12 }}>
          <h3>Summary</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{narrative}</p>
        </div>
      )}
    </div>
  )
}
