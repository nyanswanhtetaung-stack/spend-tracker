import { money } from '../lib/supabase'

// The row-by-row comparison: what you expected, what you spent, the gap.
export default function VarianceTable({ rows, loading }) {
  if (loading) return <div className="empty">Loading…</div>
  if (!rows.length) {
    return (
      <div className="empty">
        No budget or spending recorded for this month yet.
      </div>
    )
  }

  // Longest bar in the table sets the scale, so bars stay comparable.
  const widest = Math.max(...rows.map(r => Math.abs(Number(r.variance))), 1)

  return (
    <table className="ledger">
      <thead>
        <tr>
          <th>Category</th>
          <th className="num">Planned</th>
          <th className="num">Actual</th>
          <th className="num">Difference</th>
          <th style={{ width: '26%' }}>Under / over</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const v = Number(r.variance)
          const over = v > 0
          const width = (Math.abs(v) / widest) * 50   // 50% = half the axis
          return (
            <tr key={`${r.month}-${r.category}`}>
              <td>
                {r.category}
                {Number(r.planned_amount) === 0 && Number(r.actual_amount) > 0 && (
                  <> <span className="tag">NO BUDGET</span></>
                )}
              </td>
              <td className="num fig">{money(r.planned_amount)}</td>
              <td className="num fig">{money(r.actual_amount)}</td>
              <td className={`num fig ${over ? 'over' : 'under'}`}>
                {over ? '+' : '−'}{money(Math.abs(v))}
              </td>
              <td>
                <div className="varbar">
                  <span
                    className={over ? 'over' : 'under'}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
