-- Aequitas Market — Waitlist / Founding 100 Signup Table
-- Run this in Supabase SQL Editor before deploying the landing page

CREATE TABLE waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  instagram text,
  category text DEFAULT 'general',
  is_local boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Allow anonymous inserts (landing page doesn't require auth)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can sign up for waitlist"
  ON waitlist FOR INSERT
  TO anon
  WITH CHECK (true);

-- Only admin/service role can read waitlist entries
CREATE POLICY "Only authenticated users can view waitlist"
  ON waitlist FOR SELECT
  TO authenticated
  USING (true);
