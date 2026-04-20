-- Fix RLS Policies for chat_profiles
-- This script ensures profiles can be read by any authenticated user and created by the owner

-- 1. Enable RLS
ALTER TABLE public.chat_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "allow_select_profiles" ON chat_profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON chat_profiles;

-- 3. Create SELECT policy (Allow any user to see profiles)
-- This is critical for users to see who they are chatting with
CREATE POLICY "allow_select_profiles" 
ON chat_profiles FOR SELECT 
USING (true);

-- 4. Create INSERT policy (Allow users to create their own profile)
-- This usually happens via a database trigger, but manual insert needs this
CREATE POLICY "insert_own_profile" 
ON chat_profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- 5. Create UPDATE policy (Allow users to update their own profile)
DROP POLICY IF EXISTS "update_own_profile" ON chat_profiles;
CREATE POLICY "update_own_profile" 
ON chat_profiles FOR UPDATE 
USING (auth.uid() = id);

-- Verify columns
-- id: uuid (primary key, references auth.users)
-- username: text
-- avatar_url: text (optional)
