-- ============================================================
--  SPEND TRACKER — database schema
--  Paste this whole file into Supabase → SQL Editor → Run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. BUDGETS — what you PLANNED to spend, set at the start of a month
-- ------------------------------------------------------------
create table if not exists budgets (
  id             uuid primary key default gen_random_uuid(),
  month          date not null,              -- always the 1st: 2026-08-01
  category       text not null,
  planned_amount numeric(12,2) not null check (planned_amount >= 0),
  created_at     timestamptz not null default now(),

  -- One budget line per category per month. Postgres enforces this for you,
  -- so the app can't create two "Salaries" rows for August by accident.
  unique (month, category)
);

-- ------------------------------------------------------------
-- 2. EXPENSES — what you ACTUALLY spent, added as it happens
-- ------------------------------------------------------------
create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  spent_on    date not null,
  category    text not null,
  amount      numeric(12,2) not null check (amount > 0),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists expenses_spent_on_idx on expenses (spent_on);
create index if not exists expenses_category_idx on expenses (category);

-- ------------------------------------------------------------
-- 3. MONTHLY_VARIANCE — a VIEW that does the planned-vs-actual maths
--
--    A view is a saved query that behaves like a table. This is the part
--    you'd have written as PHP: instead, Postgres computes it and the app
--    just reads rows. Change the maths here and every screen updates.
--
--    FULL OUTER JOIN matters: it keeps a category that was budgeted but
--    never spent (planned 5000, actual 0) AND a category that was spent
--    but never budgeted (planned 0, actual 800) — which is exactly the
--    kind of overspend you want the report to catch.
-- ------------------------------------------------------------
create or replace view monthly_variance
with (security_invoker = on) as
with actuals as (
  select
    date_trunc('month', spent_on)::date as month,
    category,
    sum(amount)                          as actual_amount,
    count(*)                             as expense_count
  from expenses
  group by 1, 2
)
select
  coalesce(b.month,    a.month)              as month,
  coalesce(b.category, a.category)           as category,
  coalesce(b.planned_amount, 0)              as planned_amount,
  coalesce(a.actual_amount, 0)               as actual_amount,
  coalesce(a.actual_amount, 0)
    - coalesce(b.planned_amount, 0)          as variance,          -- + = over budget
  coalesce(a.expense_count, 0)               as expense_count
from budgets b
full outer join actuals a
  on a.month = b.month
 and a.category = b.category;

-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
--
--    READ THIS PART. Your browser talks straight to the database using a
--    key that anyone can read from the page source. RLS is what decides
--    who may touch which rows — it is the ONLY thing protecting the data.
--
--    Enabling RLS with no policy = nothing is readable (deny by default).
--    Each policy below then opens a specific door.
--
--    Because you chose single-user with no login, these policies allow the
--    anonymous key to read and write. That means anyone who finds your key
--    can too. Fine for a local learning project. NOT fine if you publish it
--    with real company figures in it — see README step 7 to lock it down.
-- ------------------------------------------------------------
alter table budgets  enable row level security;
alter table expenses enable row level security;

drop policy if exists "anon full access to budgets"  on budgets;
drop policy if exists "anon full access to expenses" on expenses;

create policy "anon full access to budgets"
  on budgets for all
  using (true) with check (true);

create policy "anon full access to expenses"
  on expenses for all
  using (true) with check (true);

-- ------------------------------------------------------------
-- 5. SEED DATA — so the dashboard isn't empty on first run.
--    Delete this section once you're entering real figures.
-- ------------------------------------------------------------
insert into budgets (month, category, planned_amount) values
  (date_trunc('month', current_date)::date,                  'Salaries',      42000.00),
  (date_trunc('month', current_date)::date,                  'Office rent',    8500.00),
  (date_trunc('month', current_date)::date,                  'Software',       3200.00),
  (date_trunc('month', current_date)::date,                  'Marketing',      6000.00),
  (date_trunc('month', current_date)::date,                  'Travel',         2500.00),
  (date_trunc('month', current_date)::date,                  'Utilities',      1800.00),
  ((date_trunc('month', current_date) - interval '1 month')::date, 'Salaries',  40000.00),
  ((date_trunc('month', current_date) - interval '1 month')::date, 'Office rent', 8500.00),
  ((date_trunc('month', current_date) - interval '1 month')::date, 'Software',    3000.00),
  ((date_trunc('month', current_date) - interval '1 month')::date, 'Marketing',   5000.00)
on conflict (month, category) do nothing;

insert into expenses (spent_on, category, amount, note) values
  (date_trunc('month', current_date)::date + 2,  'Salaries',    42000.00, 'Monthly payroll'),
  (date_trunc('month', current_date)::date + 1,  'Office rent',  8500.00, 'Lease payment'),
  (date_trunc('month', current_date)::date + 4,  'Software',     1450.00, 'Cloud hosting'),
  (date_trunc('month', current_date)::date + 9,  'Software',     2900.00, 'Annual design tool renewal'),
  (date_trunc('month', current_date)::date + 6,  'Marketing',    4200.00, 'Ad campaign'),
  (date_trunc('month', current_date)::date + 12, 'Marketing',    3600.00, 'Conference sponsorship'),
  (date_trunc('month', current_date)::date + 7,  'Travel',       1150.00, 'Client visit — flights'),
  (date_trunc('month', current_date)::date + 8,  'Travel',        640.00, 'Hotel'),
  (date_trunc('month', current_date)::date + 3,  'Utilities',    1620.00, 'Electricity + internet'),
  (date_trunc('month', current_date)::date + 11, 'Equipment',    2300.00, 'Two replacement laptops'),
  ((date_trunc('month', current_date) - interval '1 month')::date + 2, 'Salaries',   40000.00, 'Monthly payroll'),
  ((date_trunc('month', current_date) - interval '1 month')::date + 1, 'Office rent', 8500.00, 'Lease payment'),
  ((date_trunc('month', current_date) - interval '1 month')::date + 5, 'Software',    2850.00, 'Cloud hosting'),
  ((date_trunc('month', current_date) - interval '1 month')::date + 8, 'Marketing',   4100.00, 'Ad campaign');
