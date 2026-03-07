INSERT INTO public.categories (name, icon, user_id) VALUES
  ('Food', '🍔', NULL),
  ('Transit', '🚌', NULL),
  ('Entertainment', '🎉', NULL),
  ('Shopping', '🛍️', NULL),
  ('Utilities', '💡', NULL),
  ('Health', '💊', NULL),
  ('Education', '📚', NULL),
  ('Other', '📦', NULL)
ON CONFLICT DO NOTHING;
