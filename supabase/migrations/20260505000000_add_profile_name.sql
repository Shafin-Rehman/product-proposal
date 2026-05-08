-- Add display name to user profiles
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS name TEXT;
