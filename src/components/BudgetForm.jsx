import { useState } from 'react'
import { supabase, formatMonth } from '../lib/supabase'

// Sets the PLANNED amount for one category in the selected month.
export default function BudgetForm({ month, categories, onSaved, setError }) {
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const name = category.trim()
    if (!name || !amount) return
    setSaving(true)

    // upsert = insert, or update if that (month, category) already exists.
    // The UNIQUE constraint in schema.sql is what makes this work — without
    // it, re-entering a budget would create a duplicate row instead.
    const { error } = await supabase
      .from('budgets')
      .upsert(
        { month, category: name, planned_amount: Number(amount) },
        { onConflict: 'month,category' }
      )

    setSaving(false)
    if (error) { setError(error.message); return }
    setCategory(''); setAmount('')
    onSaved()
  }

  return (
    <div className="card">
      <h2>Set a budget</h2>
      <p className="hint">What you expect to spend in {formatMonth(month)}.</p>

      <div className="row two">
        <div>
          <label htmlFor="bcat">Category</label>
          <input
            id="bcat" list="cats" value={category} placeholder="Marketing"
            onChange={e => setCategory(e.target.value)}
          />
          <datalist id="cats">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label htmlFor="bamt">Planned amount</label>
          <input
            id="bamt" type="number" min="0" step="1" value={amount}
            placeholder="6000" onChange={e => setAmount(e.target.value)}
          />
        </div>
      </div>

      <button onClick={save} disabled={saving || !category.trim() || !amount}>
        {saving ? 'Saving…' : 'Save budget'}
      </button>
    </div>
  )
}
