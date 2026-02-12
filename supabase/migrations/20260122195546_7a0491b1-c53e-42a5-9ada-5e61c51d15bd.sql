-- Create categories table for preset and custom categories
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_preset BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Anyone can view categories
CREATE POLICY "Anyone can view categories" 
ON public.categories 
FOR SELECT 
USING (true);

-- Admins can manage categories
CREATE POLICY "Admins can manage categories" 
ON public.categories 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert preset categories
INSERT INTO public.categories (name, is_preset) VALUES
  ('Fashion', true),
  ('Food & Beverage', true),
  ('Technology', true),
  ('Entertainment', true),
  ('Sports', true),
  ('Travel', true),
  ('Health & Fitness', true),
  ('Beauty', true),
  ('Automotive', true),
  ('Finance', true),
  ('Gaming', true),
  ('Music', true),
  ('Movies & TV', true),
  ('Lifestyle', true),
  ('Social Media', true),
  ('Telecom', true),
  ('Retail', true),
  ('Other', true);