-- Run in Supabase Dashboard → SQL Editor.
-- Replace 'admin@demo.com' with the email you use to log in.

-- Step 1: Create or update profile from auth.users (creates profile if missing).
INSERT INTO public.profiles (id, first_name, mi, last_name, username, email, role)
SELECT id, 'Admin', null, 'User', email, email, 'admin'
FROM auth.users
WHERE LOWER(TRIM(email)) = LOWER('admin@demo.com')
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Step 2: If Step 1 still doesn't help, update any existing profile by email.
UPDATE public.profiles
SET role = 'admin'
WHERE LOWER(TRIM(email)) = LOWER('admin@demo.com');

-- DIAGNOSTIC: Run this to see what emails exist in auth.users and profiles.
-- SELECT 'auth.users' as src, id, email::text FROM auth.users WHERE email::text ILIKE '%admin%' OR email::text ILIKE '%demo%'
-- UNION ALL
-- SELECT 'profiles' as src, id, email FROM public.profiles WHERE LOWER(email) LIKE '%admin%' OR LOWER(email) LIKE '%demo%';
