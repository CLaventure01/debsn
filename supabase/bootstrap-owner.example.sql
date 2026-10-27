-- Run once in the Supabase SQL Editor after your first account has signed up
-- and confirmed its email. Replace the email with the exact owner email.
-- The migration intentionally does not auto-promote the first signup.
update public.profiles p
set role = 'owner', approval_status = 'approved', updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('REPLACE_WITH_OWNER_EMAIL');

-- Confirm exactly one row was updated. Then sign in again.
