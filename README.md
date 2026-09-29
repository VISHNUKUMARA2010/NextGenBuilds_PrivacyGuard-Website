# NextGenBuilds PrivacyGuard

A production-ready React + Vite + TypeScript portal for PrivacyGuard accounts and licences. The frontend uses the existing Supabase project for authentication and user-scoped licence data. No service-role key is used in the browser.

## Local setup

1. Install Node.js 20+.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local`.
4. Add the existing Supabase project URL and anon key.
5. In Supabase SQL Editor, run `supabase/schema.sql`.
6. To enable the customer notification bell and activity timeline, run `supabase/notifications.sql` in the same existing project.
7. In Supabase Authentication > URL Configuration, add your local URL and production URL to the redirect allow list.
8. Start the app with `npm run dev` (on Windows, `npm.cmd run dev` also works if PowerShell cannot resolve `npm`).

## Environment variables

```env
VITE_SUPABASE_URL=https://your-existing-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Only the public anon key belongs in the frontend. Never expose the Supabase service-role key.

## Supabase notes

The `licenses` table is linked to `auth.users` by `user_id`. Row Level Security allows authenticated users to select only their own records. Licence keys are **not** created automatically when users register. Add them manually from the Supabase SQL Editor or a trusted server-side tool. The frontend has no client insert policy and this project intentionally does not include an admin panel.

Set the email template redirect target to `/reset-password` for password recovery. Registration links redirect to `/account` after email verification.

## Cloudflare Pages

Create a Pages project connected to this repository with:

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `20` or newer

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Pages environment variables for both preview and production. The `public/_redirects` file keeps React Router routes working on refresh. Replace the canonical domain in `index.html`, `public/robots.txt`, and `public/sitemap.xml` with the final production domain.

## Routes

`/` home, `/register`, `/login`, `/forgot-password`, `/reset-password`, `/account`, `/license`, `/privacy`, `/terms`
