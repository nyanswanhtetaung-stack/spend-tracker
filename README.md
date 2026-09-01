# Spend Tracker

**[Live demo →](https://spendtrack-orcin.vercel.app/)**

Plan what the company will spend each month, record what it actually spends,
then see row by row where the two diverged.

Built with React + Vite and Supabase — the same shape Lovable generates.

---

## What Supabase is doing here

Coming from PHP + MySQL, the mental swap is:

| You used to write | Supabase equivalent |
|---|---|
| `connect.php` | `src/lib/supabase.js` — one `createClient()` call |
| `get_sessions.php` | `supabase.from('expenses').select()` straight from React |
| `save_session.php` | `supabase.from('expenses').insert()` |
| `delete_session.php` | `supabase.from('expenses').delete().eq('id', id)` |
| `auth_guard.php` | Row Level Security policies, stored in the database |
| `gemini_proxy.php` | An Edge Function (`supabase/functions/analyze`) |

**You do not write a backend.** The database publishes a REST API over your
tables, and the React app calls it directly. What you write instead is the
schema and the security policies — the thinking moves from PHP into SQL.

---

## Setup

### 1. Create the project
Go to [supabase.com](https://supabase.com), create a free project. Pick a
region near you. It takes a minute or two to spin up.

### 2. Create the tables
Open **SQL Editor** in the sidebar, paste the whole of `supabase/schema.sql`,
and hit Run. That creates two tables, a view, the security policies, and some
sample data so the dashboard isn't empty.

Check it worked: **Table Editor** should now show `budgets` and `expenses`.

### 3. Get your keys
**Project Settings → API**. Copy the **Project URL** and the **anon public**
key.

Ignore the `service_role` key. That one bypasses all security and belongs
only on a server, never in a browser app.

### 4. Connect the app
```bash
cp .env.example .env
```
Paste the two values into `.env`, then:
```bash
npm install
npm run dev
```
Open the URL it prints. You should see the seeded month with three categories
over budget.

### 5. Use it
- **Set a budget** — what you expect to spend on a category this month
- **Record an expense** — money that actually went out
- The table and the totals recompute from the database on every change
- Switch months with the dropdown at the top right

### 6. Optional — the AI summary
The "What happened" panel already works without AI: which categories went
over, by how much, and whether one of them accounts for most of the gap.
That's arithmetic, and doing it locally is instant, free, and always right.

The **Explain this in words** button is the part where a model actually adds
something — it reads your expense *notes* and tells you whether an overspend
was one renewal or a creeping pattern.

To enable it you need the Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set GEMINI_API_KEY=your_key_here
supabase functions deploy analyze
```
The key is stored in Supabase's secrets and used server-side. It never
reaches the browser — the same reason `gemini_proxy.php` existed.

Skip this entirely and the app still works; the button just reports that the
function isn't deployed.

### 7. Before you put real figures in this
Right now `schema.sql` gives the anonymous key full read and write access,
because you asked for single-user with no login. **Anyone who finds your
anon key can read and edit your data** — and it's visible in the page source.

That's fine while you're learning on your own machine. It is not fine for
real company numbers on a public URL.

To lock it down, add Supabase Auth (email login is a few lines), add a
`user_id uuid references auth.users` column to both tables, and replace the
policies with:

```sql
create policy "own rows only" on expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Now the database itself refuses to hand your rows to anyone else, no matter
what the frontend asks for. That's the real lesson of Supabase: security
lives in the database, not in your JavaScript.

---

## Files worth reading

```
supabase/schema.sql              the tables, the variance view, the RLS policies
src/lib/supabase.js              client setup
src/App.jsx                      all the reads and writes
src/lib/analyse.js               works out what went over budget
src/components/VarianceTable.jsx the row-by-row comparison
supabase/functions/analyze/      the Gemini call, server-side
```

The most interesting file is `schema.sql`. The `monthly_variance` view does
the planned-vs-actual maths in SQL, so the React code never calculates
anything — it just displays rows. Change the maths there and every screen
updates at once.
