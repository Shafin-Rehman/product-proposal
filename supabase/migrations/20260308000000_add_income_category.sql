CREATE TABLE IF NOT EXISTS public.income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT
);

INSERT INTO public.income_sources (name, icon) VALUES
  ('Salary', '💼'),
  ('Freelance', '💻'),
  ('Part-time', '⏱️'),
  ('Business', '🏢'),
  ('Investment', '📈'),
  ('Rental', '🏠'),
  ('Gift', '🎁'),
  ('Other', '💰')
ON CONFLICT DO NOTHING;

ALTER TABLE public.income
  DROP COLUMN IF EXISTS source;

ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.income_sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_income_user_source_id ON public.income (user_id, source_id);