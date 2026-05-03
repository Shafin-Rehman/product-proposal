CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  icon TEXT,
  target_amount NUMERIC(10, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date DATE NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user_active
  ON public.savings_goals (user_id, archived, target_date ASC);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user_updated
  ON public.savings_goals (user_id, updated_at DESC);
