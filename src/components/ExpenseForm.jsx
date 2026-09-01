import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Records an ACTUAL expense.
export default function ExpenseForm({ month, categories, onSaved, setError }) {
  const [spentOn, setSpentOn] = useState(defaultDate(month))
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const name = category.trim()
    if (!name || !amount || !spentOn) return
    setSaving(true)

    const { error } = await supabase.from('expenses').insert({
      spent_on: spentOn,
      category: name,
      amount: Number(amount),
      note: note.trim() || null,
    })

    setSaving(false)
    if (error) { setError(error.message); return }
    setCategory(''); setAmount(''); setNote('')
    onSaved()
  }

  return (
    <div className="card">
      <h2>Record an expense</h2>
      <p className="hint">Money that actually went out.</p>

      <div className="row three">
        <div>
          <label htmlFor="edate">Date</label>
          <input id="edate" type="date" value={spentOn}
                 onChange={e => setSpentOn(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ecat">Category</label>
          <input id="ecat" list="cats" value={category} placeholder="Travel"
                 onChange={e => setCategory(e.target.value)} />
        </div>
        <div>
          <label htmlFor="eamt">Amount</label>
          <input id="eamt" type="number" min="0" step="1" value={amount}
                 placeholder="640" onChange={e => setAmount(e.target.value)} />
        </div>
      </div>

      <div className="row">
        <div>
          <label htmlFor="enote">Note</label>
          <input id="enote" value={note} placeholder="Hotel for client visit"
                 onChange={e => setNote(e.target.value)} />
        </div>
      </div>

      <button onClick={save} disabled={saving || !category.trim() || !amount}>
        {saving ? 'Saving…' : 'Add expense'}
      </button>
    </div>
  )
}

function defaultDate(month) {
  const today = new Date().toISOString().slice(0, 10)
  return today.startsWith(month.slice(0, 7)) ? today : month
}
