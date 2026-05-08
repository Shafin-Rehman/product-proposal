-- Add archived and updated_at columns to categories table
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Index for efficient filtering by user and archived status
CREATE INDEX IF NOT EXISTS idx_categories_user_archived
  ON public.categories (user_id, archived);