CREATE TABLE IF NOT EXISTS public.recurring_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  amount        NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  category_id   UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  source_id     UUID REFERENCES public.income_sources(id) ON DELETE SET NULL,
  description   TEXT,
  frequency     TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  start_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  next_date     DATE NOT NULL,
  paused        BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS recurring_rule_id UUID REFERENCES public.recurring_rules(id) ON DELETE SET NULL;

ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS recurring_rule_id UUID REFERENCES public.recurring_rules(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS expenses_user_recurring_rule_date_unique
  ON public.expenses (user_id, recurring_rule_id, date)
  WHERE recurring_rule_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS income_user_recurring_rule_date_unique
  ON public.income (user_id, recurring_rule_id, date)
  WHERE recurring_rule_id IS NOT NULL;
