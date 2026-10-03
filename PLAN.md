# Openbox Ventures Panel - Plan

Centralized internal app: attendance, leave, chat, video calls, org structure (offices, departments).
Two panels in one Next.js app: `/` employee, `/admin` admin.

## Stack

| Concern | Choice | Note |
|---|---|---|
| Framework | Next.js 16 (App Router, Server Actions) | `proxy.ts` replaces `middleware.ts` in v16 |
| Auth | Clerk | Sign-in only, no public sign-up. Admin invites by email |
| DB | Supabase Postgres + RLS | Clerk → Supabase native third-party auth (Clerk JWT, `auth.jwt()->>'sub'` in RLS) |
| Realtime chat | Supabase Realtime (`postgres_changes` on `messages`) | No extra service |
| Storage | Supabase Storage | buckets: `avatars`, `attachments`, `leave-docs` |
| Video | Jitsi Meet (`meet.jit.si`) opened in a new tab | Embedding meet.jit.si is capped at 5 min, so no iframe. Swap to self-hosted Jitsi / LiveKit if need embedding/recording |
| UI | Tailwind 4 + a few component classes in `globals.css` | shadcn skipped: native inputs/`<details>` cover it |

Skipped: separate admin app, Redux/Zustand, ORM (supabase-js typed via `supabase gen types`), custom WebRTC, email service (Clerk sends invites).

## Roles

`employee`, `manager` (head of one office: sees/approves that office's attendance + leave), `admin` (everything, all offices).
Stored in Clerk `publicMetadata.role` (missing = employee), added to the session token as `metadata.role`. `proxy.ts` gates `/admin`, layouts re-check, RLS reads `auth.jwt()->'metadata'->>'role'`. Manager scope = their `employees.office_id` (no separate office→manager link).

## Data model (Postgres)

```sql
offices      (id, name, address, timezone, lat, lng, radius_m,
              work_start time, work_end time, grace_min int default 15,
              work_days int[] default '{1,2,3,4,5}',   -- ISO weekday, admin-set
              created_at)
departments  (id, name, office_id → offices, created_at)
employees    (id, clerk_user_id unique, email, full_name, avatar_url,
              office_id → offices, department_id → departments,
              designation, joined_on, active bool default true)

attendance   (id, employee_id, date, mode enum('office','wfh'),
              check_in_at, check_out_at, check_in_lat, check_in_lng, note,
              unique(employee_id, date))            -- one row/day, DB enforces
              -- worked hours, late (check_in > work_start + grace), early-leave: computed in a VIEW, not stored

holidays     (id, office_id null = all offices, date, name)
leave_types  (id, name, paid bool, yearly_quota numeric,          -- admin-set leave policy
              accrual enum('yearly','monthly'),             -- monthly = quota/12 per month
              carry_forward_max numeric default 0,
              allow_half_day bool, doc_required_after_days int null, active bool)
leave_requests (id, employee_id, leave_type_id, start_date, end_date, half_day bool, days,
              reason, doc_path, status enum('pending','approved','rejected','cancelled'),
              reviewed_by, reviewed_at, review_note)
              -- balance = accrued-to-date + carried_forward - approved days, a VIEW
leave_carry_forward (employee_id, leave_type_id, year, days)   -- written once/year by admin "close year" action

channels     (id, name, type enum('dm','group','department'), department_id null, created_by)
channel_members (channel_id, employee_id, last_read_at, primary key both)
messages     (id, channel_id, sender_id, body, attachment_path, created_at)

-- announcements = the single channels row with announcements = true; admins + managers post, triggers add automated posts
```

RLS sketch:
- helper `current_employee()` → row where `clerk_user_id = auth.jwt()->>'sub'`.
- employees: read all active; update own profile fields only; admin full.
- attendance / leave_requests: own rows; manager → employees of offices they manage; admin → all.
- messages / channels: only if member of channel.
- offices / departments / leave_types / holidays: read all, write admin.

## Routes

```
proxy.ts                         Clerk auth; /admin → require role admin|manager
app/sign-in/[[...sign-in]]
app/(employee)/
  page.tsx                       dashboard: today status, check-in/out button, leave balance, announcements
  attendance/                    my history, monthly calendar
  leave/                         apply, my requests, balances
  chat/[channelId]/              channel list + messages (realtime)
  meet/[room]/                   Jitsi iframe, room = channel id
  directory/                     colleagues by office/department
  profile/
app/admin/                       admin: all offices; manager: same pages scoped to own office by RLS
  page.tsx                       today: present/absent/on-leave counts per office
  employees/                     invite (Clerk invitation w/ publicMetadata.role), edit role (Clerk API)/office/dept, deactivate
  offices/                       CRUD, geofence (map pin + radius), office hours, work days, assign manager
  departments/                   CRUD, set head
  attendance/                    filter by office/dept/date, fix entries, CSV export
  leave/                         approve/reject queue, leave policy (types/quota/accrual/carry-forward/half-day), holidays, close year
  announcements/
```

Mutations = Server Actions. No REST layer.

## Key flows

- **Onboarding**: admins created by `npm run create-admin`. Admin invites (email, office, dept; no role) → user signs up → "no role yet" screen → admin assigns role → pending `employees` row → Clerk invitation email → first sign-in links `clerk_user_id` by verified email (`lib/me.ts`). No webhook.
- **Check-in**: two buttons, **Office** / **Work from home** → Server Action → insert today's row (unique constraint blocks doubles). Date in office timezone.
  - Office: browser `navigator.geolocation` → server checks haversine distance ≤ office `radius_m`, else reject. Location denied → can't check in as Office.
  - WFH: no location check, location stored if granted. Shown as WFH in admin/manager reports.
  - Late flag from office `work_start + grace_min`.
- **Check-out**: update today's row `check_out_at`. Forgot to check out → admin fixes; no cron.
- **Leave**: apply → `pending` → office manager or admin approves → counts in balance view. Overlap + balance check in Server Action. Days excludes non-work days (office `work_days`) + office holidays. Half-day only if type allows.
- **Chat**: subscribe to `messages` inserts filtered by `channel_id`; unread = messages after `last_read_at`. Department channels auto-created with department.
- **Video**: "Start call" in a channel → open `/meet/<channelId>`, post link as message. Jitsi handles the rest.

## Phases

1. **Foundation** ✅ - Clerk + Supabase wiring, schema migration, RLS + test, layouts for both panels.
2. **Org** ✅ - offices (geofence, hours), departments, employees, invites, directory.
3. **Attendance** ✅ - Office/WFH check-in, geofence check, late flag, history, admin/manager view, CSV export.
4. **Leave** ✅ - admin leave policy, holidays, requests, manager approvals, balances, close year.
5. **Chat** ✅ - channels, DMs, realtime, attachments, unread counts.
6. **Video** ✅ - Jitsi rooms from chat.
7. **Polish** ✅ - announcements, dashboard stats, mobile layout. Deploy steps in README.

## Deferred (add when actually needed)

- Payroll export / salary - out of scope until asked.
- Per-employee shifts - office hours apply to everyone in office until needed.
- WFH approval/limits - WFH free, just reported, until abused.
- Per-office leave policy - one company-wide policy until offices differ.
- Push/email notifications - in-app badges first.
- Message search, threads, reactions - plain chat first.
- Audit log table - add if compliance asks.

## Decisions

- Check-in: Office (geofenced) or WFH.
- Office hours, work days, grace: admin per office.
- Leave policy: admin-managed, company-wide.
- Video: public `meet.jit.si`.
- Each office has one manager; admins global.

## Open questions

1. Geolocation spoofable via browser devtools. OK for now? Stricter = office Wi-Fi IP allowlist (add `offices.allowed_ips`).
