-- ============================================================
--  SPEND TRACKER — add accounts, and make the database enforce
--  that you only ever see your own rows.
--
--  Run this AFTER schema.sql, once, in Supabase → SQL Editor.
--  It is safe to run twice.
--
--  What changes:
--    before — the anonymous key could read and write every row
--    after  — every row belongs to a user, and Postgres refuses
--             to hand your rows to anyone else
-- ============================================================

-- ------------------------------------------------------------
-- 1. Give every row an owner
--
--    `default auth.uid()` is the important bit. auth.uid() reads the
--    user id out of the JWT the browser sent. So an INSERT never has
--    to pass user_id at all — the database stamps it. That means the
--    frontend cannot get it wrong, and cannot lie about it either.
-- ------------------------------------------------------------
alter table budgets
  add column if not exists user_id uuid
  references auth.users (id) on delete cascade
  default auth.uid();

alter table expenses
  add column if not exists user_id uuid
  references auth.users (id) on delete cascade
  default auth.uid();

create index if not exists budgets_user_idx  on budgets  (user_id);
create index if not exists expenses_user_idx on expenses (user_id);

-- ------------------------------------------------------------
-- 2. Scope the uniqueness rule per user
--
--    The old rule said "one Salaries budget per month" across the whole
--    table. With more than one account that is wrong — two people would
--    collide. It has to be one per category per month PER USER.
-- ------------------------------------------------------------
alter table budgets drop constraint if exists budgets_month_category_key;

create unique index if not exists budgets_user_month_category_key
  on budgets (user_id, month, category);

-- ------------------------------------------------------------
-- 3. Replace the wide-open policies with owner-only ones
--
--    The old policies said `using (true)` — everyone, everything.
--    These say: this row is yours only if its user_id matches the id
--    in your token.
--
--      using      — which existing rows you may read, update, delete
--      with check — which new rows you are allowed to create
--
--    Rows left over from before accounts existed have user_id = null,
--    so they match nothing and are invisible. Nothing is deleted; see
--    section 5 if you want to claim them.
-- ------------------------------------------------------------
alter table budgets  enable row level security;
alter table expenses enable row level security;

drop policy if exists "anon full access to budgets"  on budgets;
drop policy if exists "anon full access to expenses" on expenses;
drop policy if exists "own budgets only"             on budgets;
drop policy if exists "own expenses only"            on expenses;

create policy "own budgets only"
  on budgets for all
  to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own expenses only"
  on expenses for all
  to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- 4. Take the anonymous key off the table entirely
--
--    The anon key is printed in the page source of the deployed site.
--    Anyone can read it. After this, holding it gets you nothing but a
--    login screen.
-- ------------------------------------------------------------
revoke all on budgets  from anon;
revoke all on expenses from anon;

-- ------------------------------------------------------------
-- 5. OPTIONAL — claim the rows that existed before accounts
--
--    Sign up in the app first, then find your id under
--    Authentication → Users, and run these two lines with it:
--
--      update budgets  set user_id = 'PASTE-YOUR-USER-ID' where user_id is null;
--      update expenses set user_id = 'PASTE-YOUR-USER-ID' where user_id is null;
--
--    Or leave them — a fresh account starts empty, which is arguably
--    the better first impression for anyone trying the demo.
-- ------------------------------------------------------------
