# Debsn’s Inc. Delivery

Local Vite app for the Debsn delivery operations dashboard. Supabase Auth is wired for email/password accounts, email confirmation, password reset, and automatic access after email confirmation. The delivery screens still use sample browser data; live orders, driver accounts, routing, and delivery notifications are separate build work.

## Run locally

1. Install Node.js 20.19+ (or 22.12+) and run `npm install`.
2. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using this project's Supabase URL and **publishable** key.
3. Run `npm run dev` and open `http://localhost:3000`.

The local `.env.local` is gitignored. The publishable key is designed for browser use; never put a Supabase service-role key in a `VITE_` variable.

## Authentication and initial owner

The Supabase project has the `profiles` table, signup trigger, and row-level security migration in `supabase/migrations/202610270001_profiles_auth.sql`. New accounts get the `dispatcher` role and can enter the workspace after confirming their email; owner approval is not required. Suspended accounts remain blocked.

Email confirmation is enabled in Supabase Auth. Any confirmed user can sign in. If you need a workspace owner role for a future member-management screen, run `supabase/bootstrap-owner.example.sql` in the Supabase SQL Editor after replacing `REPLACE_WITH_OWNER_EMAIL` with the exact owner's email. The migration also exposes an owner-checked `approve_workspace_member(user_id, role)` RPC for future role management.

For password reset and email confirmation links, local development uses `http://localhost:3000`, which matches the current Supabase Site URL. Add the eventual production URL to Supabase Auth's allowed redirect URLs before publishing the app.

## Publish checklist

- Set Vercel's build command to `npm run build` and output directory to `dist` (Vite defaults).
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel Preview and Production environments.
- Add the production URL to Supabase Auth's Site URL / Redirect URLs and test confirmation and password reset emails.
- Push only after the owner approves.
