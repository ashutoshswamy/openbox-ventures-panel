# Open Box Ventures LLP - Panel

Internal app: attendance, leave, chat, video meetings. See `PLAN.md`.

## Setup

1. `npm install`, then `cp .env.example .env.local` and fill in keys.
2. **Clerk**
   - Create app, copy keys.
   - Configure → Restrictions → Sign-up mode: **Restricted** (invite only).
   - Integrations → **Supabase** → activate; copy the Clerk domain.
   - Sessions → **Customize session token** → claims:
     ```json
     { "metadata": "{{user.public_metadata}}" }
     ```
   - Roles live in each user's **public metadata**: `{"role": "employee" | "manager" | "admin"}`.
     No role = no access (user sees a "waiting for role" screen). The app sets this; don't edit by hand.
3. **Supabase**
   - Authentication → Sign In / Providers → Third-party auth → add **Clerk**, paste domain.
   - SQL editor: run `supabase/schema.sql` (tables, RLS, functions, private buckets `leave-docs` + `attachments`).
   - Then run each file in `supabase/migrations/` in filename order.
   - Start over: run `supabase/reset.sql` (**deletes all app data**), then `schema.sql` again.
4. Create admins (Clerk user + Supabase row, linked):
   ```bash
   npm run create-admin -- you@openboxventures.com "Your Name" 'a-strong-password'
   ```
   Re-running on an existing email promotes that user to admin.
5. `npm run dev`, sign in.

## First run

1. Admin panel → **Offices**: create each office (stand inside it and click *Use my location*), set hours, radius, working days.
2. **Departments**: add per office (each gets a chat channel automatically).
3. **Leave policy**: add leave types (quota, monthly/yearly credit, carry-forward, half-day, document rule) and holidays.
4. **Employees**: invite people (name, email, office/department). They sign up, fill in the onboarding form
   (personal details, address, emergency contact), then wait on a "no role yet" screen.
   Open them in Employees (badge **Needs role**), pick Employee / Manager / Admin, Save. Their page moves on within ~15 s or on refresh.
   Managers see and approve only their own office.

## Deploy (Vercel)

1. Import repo in Vercel, add the same env vars.
2. Clerk: create a **production** instance, use its keys, add the production domain, redo the Supabase integration + session token claim, and add the new Clerk domain in Supabase third-party auth.
3. Office check-in needs HTTPS (browser geolocation); Vercel provides it.

## Scripts

- `npm run dev` / `build` / `lint`
- `npm run test:rls` - runs schema + reset in in-memory Postgres; checks access rules, check-in geofence, leave rules, chat membership.
