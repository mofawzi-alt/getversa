-- Add category_interests column to users table (array of text for multiple interests)
ALTER TABLE public.users ADD COLUMN category_interests text[] DEFAULT '{}'::text[];