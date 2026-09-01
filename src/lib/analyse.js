// analyse.js
// ------------------------------------------------------------------
// Works out WHICH categories blew the budget and by how much.
//
// Worth being clear about something: this part is arithmetic, not AI.
// "Marketing went over by 1,800" is subtraction — asking a language model
// to do it would be slower, cost money, and occasionally get it wrong.
//
// Where a model genuinely helps is the sentence AFTER that: reading the
// individual expense notes and saying "the overspend is one conference
// sponsorship, not a creeping trend." That's in supabase/functions/analyze.
// ------------------------------------------------------------------

export function analyseMonth(rows, expenses = []) {
  const plannedTotal = rows.reduce((s, r) => s + Number(r.planned_amount), 0)
  const actualTotal = rows.reduce((s, r) => s + Number(r.actual_amount), 0)
  const variance = actualTotal - plannedTotal

  // Over-budget categories, worst first
  const over = rows
    .filter(r => Number(r.variance) > 0)
    .sort((a, b) => Number(b.variance) - Number(a.variance))

  const under = rows
    .filter(r => Number(r.variance) < 0)
    .sort((a, b) => Number(a.variance) - Number(b.variance))

  // Money spent on a category that had no budget line at all
  const unbudgeted = rows.filter(
    r => Number(r.planned_amount) === 0 && Number(r.actual_amount) > 0
  )

  const findings = []

  if (rows.length === 0) {
    return { plannedTotal, actualTotal, variance, findings: [], over, under, unbudgeted }
  }

  findings.push(
    variance > 0
      ? {
          tone: 'over',
          title: `Over budget by ${fmt(variance)}`,
          detail: `Planned ${fmt(plannedTotal)}, spent ${fmt(actualTotal)} — ` +
                  `${pct(variance, plannedTotal)} above plan.`,
        }
      : {
          tone: 'under',
          title: `Under budget by ${fmt(Math.abs(variance))}`,
          detail: `Planned ${fmt(plannedTotal)}, spent ${fmt(actualTotal)}.`,
        }
  )

  over.forEach(r => {
    const share = plannedTotal > 0 ? Number(r.variance) / Math.abs(variance || 1) : 0
    findings.push({
      tone: 'over',
      title: `${r.category} — ${fmt(r.variance)} over`,
      detail:
        `Budgeted ${fmt(r.planned_amount)}, spent ${fmt(r.actual_amount)} ` +
        `across ${r.expense_count} ${r.expense_count === 1 ? 'entry' : 'entries'}.` +
        (variance > 0 && share > 0.4
          ? ` This single category accounts for most of the overspend.`
          : ''),
    })
  })

  unbudgeted.forEach(r => {
    findings.push({
      tone: 'over',
      title: `${r.category} was never budgeted`,
      detail: `${fmt(r.actual_amount)} spent with no planned amount set for this month.`,
    })
  })

  if (over.length === 0) {
    findings.push({
      tone: 'under',
      title: 'Every category stayed within plan',
      detail: 'No overspend to explain this month.',
    })
  }

  return { plannedTotal, actualTotal, variance, findings, over, under, unbudgeted }
}

function fmt(n) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency', currency: 'MYR', maximumFractionDigits: 0,
  }).format(Math.abs(Number(n) || 0))
}

function pct(part, whole) {
  if (!whole) return '—'
  return `${Math.round((Math.abs(part) / whole) * 100)}%`
}
