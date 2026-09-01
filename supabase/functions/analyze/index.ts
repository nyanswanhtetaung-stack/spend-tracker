// supabase/functions/analyze/index.ts
// ------------------------------------------------------------------
// An Edge Function is a small script that runs on Supabase's servers,
// not in the browser. It exists for one reason here: the Gemini API key
// must never be sent to the visitor.
//
// This is the same job gemini_proxy.php did in your PHP project — browser
// calls your server, your server adds the key and calls Google.
//
// Deploy:
//   supabase secrets set GEMINI_API_KEY=your_key_here
//   supabase functions deploy analyze
// ------------------------------------------------------------------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Require a signed-in user, not just the anon key.
  //
  // Supabase has already verified this token's signature before we run —
  // but it accepts the anon key as a valid token, and the anon key is
  // printed in the page source of the deployed site. Without this check a
  // stranger could call this endpoint all day and spend the Gemini quota.
  // The 'role' claim tells the two apart.
  if (roleFromRequest(req) !== 'authenticated') {
    return json({ error: 'Sign in to use the written summary.' }, 401)
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return json({ error: 'GEMINI_API_KEY is not set. Run: supabase secrets set GEMINI_API_KEY=...' }, 500)
    }

    const { month, plannedTotal, actualTotal, overspend, expenses } = await req.json()

    // Only send what the model needs. Notes are the useful part — they carry
    // the "why" that the numbers alone can't.
    const payload = {
      contents: [{
        role: 'user',
        parts: [{
          text: JSON.stringify({ month, plannedTotal, actualTotal, overspend, expenses }),
        }],
      }],
      systemInstruction: {
        parts: [{
          text:
            'You are a finance assistant summarising one month of company spending. ' +
            'You receive the planned and actual totals, the categories that went over budget, ' +
            'and the individual expense entries with their notes. ' +
            'Write 3-5 short sentences for a manager. Say which categories drove the overspend and, ' +
            'reading the notes, whether each looks like a one-off (a renewal, a single event) or a ' +
            'pattern of repeated small costs — that distinction is the point of your answer. ' +
            'End with one concrete suggestion for next month. ' +
            'Use the same currency figures you were given. No markdown, no headings, no bullet points. ' +
            'Never invent an expense that is not in the data.',
        }],
      },
    }

    const resp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(payload),
      }
    )

    const data = await resp.json()
    if (!resp.ok) return json({ error: data?.error?.message || 'Gemini request failed' }, resp.status)

    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!summary) return json({ error: 'Gemini returned an empty response' }, 502)

    return json({ summary })
  } catch (err) {
    console.error(err)
    return json({ error: 'Unexpected error in analyze function' }, 500)
  }
})

function roleFromRequest(req: Request): string {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearers+/i, '')
  try {
    const claims = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(claims)).role || ''
  } catch {
    return ''
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
