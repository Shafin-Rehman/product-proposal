ALTER TABLE public.income
  ADD COLUMN date DATE;

UPDATE public.income
SET date = month
WHERE date IS NULL;

ALTER TABLE public.income
  ALTER COLUMN date SET NOT NULL;

DROP INDEX IF EXISTS idx_income_user_month;

CREATE INDEX IF NOT EXISTS idx_income_user_date ON public.income (user_id, date DESC);

ALTER TABLE public.income
  DROP COLUMN month;
