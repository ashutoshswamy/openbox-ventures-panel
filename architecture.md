# Architecture

How the Open Box Ventures LLP Panel (`panel.openboxventures.in`) is built and how each portal works.
Diagrams are [Mermaid](https://mermaid.js.org/) and render on GitHub / VS Code.

## 1. System overview

```mermaid
flowchart LR
  U[Browser / installed PWA] -->|"HTTPS"| P[proxy.ts<br/>Clerk session]
  P --> N[Next.js 16 App Router<br/>Server Components + Server Actions]
  N -->|"user JWT · db()"| S[(Supabase Postgres<br/>RLS + SQL functions)]
  N -->|"service key · adminDb()<br/>first sign-in link, cron, celebrations"| S
  N -->|"invites, roles, bans"| C[Clerk]
  U -->|"signed upload URL"| ST[(Supabase Storage<br/>leave-docs, attachments)]
  U <-->|"Realtime postgres_changes"| S
  U -->|"new tab"| J[Jitsi Meet<br/>video calls]
  V[Vercel Cron 03:00 UTC] -->|"Bearer CRON_SECRET"| R[/api/cron/reminders/]
  R --> S
```

| Layer | Where | Job |
|---|---|---|
| Session | `proxy.ts` | Clerk session + strict CSP (per-request script nonce); no access decisions |
| Who am I | `lib/me.ts` | `getMe()` links Clerk user → `employees` row; page guards `employeePage / staffPage / hrPage / adminPage`; action guards `requireMe / requireStaff / requireAdmin` (+ per-employee rate limit, `rateLimit()`) |
| Data rules | `supabase/schema.sql` | RLS on every table; business rules in `security definer` functions (check-in geofence, leave balance, approvals, payroll) so they can't be bypassed via the API |
| Live UI | `components/live-refresh.tsx` | Any change to a published table the user can read → `router.refresh()` |
| Schema reset | `supabase/reset.sql` | Drops everything; then run `schema.sql` |

Access is checked twice: the TS guard (UX, redirects) and RLS / SQL functions (the real gate).

## 2. Roles and portals

Role lives in Clerk `publicMetadata.role`, carried in the JWT as `metadata.role` (read in SQL by `my_role()`).

```mermaid
flowchart TD
  A[Sign in] --> B{getMe}
  B -->|"no invite / deactivated"| X[/no-access/]
  B -->|"details form not filled<br/>non-admin"| PR[/profile/]
  B -->|"no role yet"| PE[/pending/]
  B -->|"employee"| W[Workspace /]
  B -->|"manager"| W
  B -->|"hr"| W
  B -->|"admin"| AD[Admin panel /admin]
  W -->|"switch: Manager panel"| MG[Manager panel /admin]
  W -->|"switch: HR portal"| HR[HR portal /hr]
```

| Role | Portals | Scope |
|---|---|---|
| `employee` | Workspace | Self |
| `manager` | Workspace + Manager panel (`/admin`) | Own department in own office (`manages()`), first-step leave approval for employees |
| `branch_head` | Workspace + Manager panel (`/admin`) | All departments in own office, first-step leave approval for employees and managers |
| `hr` | Workspace + HR portal (`/hr`) | Own office: final leave approval, regularizations, payroll prep |
| `admin` | Admin panel (`/admin`) only | Whole org; no attendance/leave of their own |

`manages(emp)` = admin, branch head/HR in the same `office_id`, or manager in the same `office_id` + `department_id` (never yourself).

## 3. Workspace (`/`) — every non-admin

| Page | What |
|---|---|
| `/` Dashboard | Check-in card, reminders (to-dos due, birthdays, anniversaries, next holiday) |
| `/todos` | Personal list + tasks assigned by managers/HR/admin |
| `/attendance` | History, monthly stats, **regularization** requests |
| `/leave` | Balances, apply, cancel, add/replace document |
| `/chat` | DMs, groups, department channels, Announcements |
| `/directory`, `/org` | Colleagues, org chart |
| `/profile` | Personal details, bank details, my salary |
| `/support` | Report an issue to admins |

### Daily attendance

```mermaid
sequenceDiagram
  actor E as Employee
  participant UI as Today card
  participant DB as check_in()
  E->>UI: Office / WFH
  UI->>UI: browser geolocation (office only)
  UI->>DB: check_in(mode, lat, lng)
  DB->>DB: active employee? not admin?<br/>within office radius_m?
  DB-->>UI: attendance row (unique per day)
  E->>UI: Check out
  UI->>DB: check_out()
```

`attendance_report` view adds `late` (after `work_start + grace_min`), `early_leave`, `hours`.

### Regularization (missed / wrong check-in)

```mermaid
flowchart LR
  E[Employee] -->|"date, mode, in, out, reason"| RQ[request_regularization]
  RQ -->|"≤ 5 per month (pending + approved)<br/>past date, one per day"| P[(pending)]
  P -->|"HR of office or admin"| RV[review_regularization]
  RV -->|"approve"| A[approved → attendance row upserted<br/>note 'Regularized: reason']
  RV -->|"reject"| R[rejected]
```

### Leave (two-step approval)

```mermaid
stateDiagram-v2
  [*] --> pending: apply_leave()<br/>balance, overlap, doc rules
  pending --> cancelled: cancel_leave() (employee)
  pending --> manager_approved: dept manager / branch head approves
  pending --> rejected: manager / branch head / HR / admin rejects
  pending --> approved: HR/admin final, only if<br/>nobody can give step 1 or applicant is a branch head<br/>(admin always)
  manager_approved --> approved: HR (own office) / admin
  manager_approved --> rejected: HR / admin
  approved --> [*]
```

- All reviews go through `review_leave()`; direct updates are revoked.
- HR's own leave → admin only. Nobody reviews their own.
- `leave_balances`: `manager_approved` counts as pending, not used.
- Documents: upload to `leave-docs` via signed URL; `update_leave_doc()` attaches/replaces on pending / manager-approved / approved requests. Downloads via `/files/leave/[id]` (RLS lookup → short-lived signed URL).

### Chat

```mermaid
flowchart LR
  D[Department created] -->|"trigger"| DC[Department channel<br/>members = department]
  E[Employee] -->|"dm_with"| DM[DM channel]
  E -->|"create group"| G[Group channel]
  T[Triggers + daily_reminders] -->|"post_announcement"| AN[Announcements channel<br/>everyone reads<br/>admin / manager / HR post]
  DM & G & DC & AN --> RT[Realtime → live refresh]
```

Admins are not chat members (use Report an issue). Video call = Jitsi room named after the channel id.

## 4. Manager panel (`/admin`, role `manager`)

Overview · To-do · Employees (own office, read-only) · Org chart · Attendance (fix entries, see regularizations as "Waiting for HR") · Leave (first-step approval) · Announcements.

```mermaid
flowchart LR
  M[Manager] --> L[Leave queue]
  L -->|"pending, team member"| A1[Approve → manager_approved]
  L -->|"pending"| R1[Reject]
  M --> AT[Attendance]
  AT --> F[Add / edit / delete day entries]
  M --> T[Assign to-dos to own office]
```

## 5. HR portal (`/hr`, role `hr`)

`app/hr/*` re-exports the admin pages, so logic lives once; RLS scopes everything to HR's office.

| Page | What |
|---|---|
| `/hr` Overview | Headcount, joiners this month, exits in 30 days, open leave, pending regularizations, today's present / on leave / not in |
| `/hr/leave` | Final approval, with balance, leave taken this year, manager's note |
| `/hr/attendance` | Day view + approve/reject regularizations |
| `/hr/payroll` | Salaries, increments, bank details, build & submit salary sheets |
| `/hr/employees`, `/hr/org` | Office employees (All / Active / Deactivated), org chart |
| `/hr/todos`, `/hr/announcements` | Assign tasks, post announcements |

Nav badges (Leave, Attendance) come from `lib/pending.ts → pendingCounts()`.

### Payroll (India CTC) — HR prepares, admin approves

```mermaid
sequenceDiagram
  actor H as HR / Admin
  participant APP as createRun (TS)
  participant CALC as lib/payroll.ts
  participant DB as Postgres
  actor A as Admin
  H->>DB: add_salary(emp, annual CTC, effective_from) — increments = new revision
  H->>APP: Create sheet for month (office)
  APP->>DB: salaries, approved unpaid leave, attendance, holidays
  APP->>CALC: CTC → Basic 50%, HRA 40% of basic, PF, ESI, PT, special allowance
  APP->>CALC: LOP days = unpaid leave + absent working days
  APP->>DB: create_payroll_run(month, office, lines) — scope checked per employee
  H->>DB: update_payroll_line(LOP, TDS, other) while draft — net recomputed in SQL
  H->>DB: submit_payroll_run()
  A->>DB: review_payroll_run(approve | send back with note)
```

```mermaid
stateDiagram-v2
  [*] --> draft: create_payroll_run
  draft --> submitted: submit (HR / admin)
  submitted --> approved: admin approves (locked)
  submitted --> draft: admin sends back + note
  draft --> [*]: delete_payroll_run
```

Salary and bank rows are visible to the employee, admin, and HR of the employee's office only — never managers or colleagues (`can_see_pay()`). CSV export: `/hr/payroll/[id]/export`.

## 6. Admin panel (`/admin`, role `admin`)

Everything managers see, org-wide, plus: Offices (geofence, hours, work days) · Departments · Employees (invite, role, code, alias, company mobile, joined/exit date, reports to, deactivate) · Leave policy & holidays (incl. CSV import) · Payroll approval · Issues.

### Invite → active employee

```mermaid
sequenceDiagram
  actor A as Admin
  participant APP as inviteEmployee
  participant C as Clerk
  participant DB as employees
  actor E as New hire
  A->>APP: email, name, office, department, code...
  APP->>DB: insert employees row (no clerk_user_id)
  APP->>C: invitation → /sign-up
  E->>C: sign up (verified email)
  E->>APP: first visit → getMe()
  APP->>DB: link clerk_user_id by email, joined_on = today
  E->>APP: fill personal details (/profile)
  APP-->>E: /pending (no role yet)
  A->>C: set role (publicMetadata)
  C-->>DB: role copy synced on next visit → welcome announcement
```

Deactivate = `employees.active = false` (RLS cuts access) + Clerk ban.

### Org chart

`employees.reports_to` (set by admin) → tree in `components/org-chart.tsx`. A trigger blocks cycles; roots = people without an active manager; no reporting lines at all → grouped by department.

## 7. Automations

```mermaid
flowchart TD
  subgraph Triggers
    H[holiday inserted] --> P1[announce: Holiday added]
    O[office created] --> P2[announce: New office]
    J[first role assigned to recent joiner] --> P3[announce: Welcome]
    DP[department created / renamed] --> P4[department channel]
  end
  subgraph CSV[Holiday CSV import]
    I[import_holidays rows] -->|"validate all, skip duplicates,<br/>per-row post suppressed"| P5[one summary announcement]
  end
  subgraph Daily[Vercel Cron → daily_reminders]
    B[birthdays, Feb 29 → Feb 28] --> L{reminder_log<br/>already posted today?}
    AN[work anniversaries] --> L
    TH[holiday tomorrow] --> L
    L -->|"no"| P6[announce]
    L -->|"yes"| S[skip]
  end
```

UI reminders (no notification table): Workspace dashboard card, admin "Needs attention" (approvals waiting > 24h), nav count badges.

## 8. Data model

```mermaid
erDiagram
  offices ||--o{ departments : has
  offices ||--o{ employees : "office_id"
  departments ||--o{ employees : "department_id"
  employees ||--o{ employees : "reports_to"
  employees ||--o| employee_profiles : details
  employees ||--o| employee_bank : bank
  employees ||--o{ employee_salaries : revisions
  employees ||--o{ attendance : "one per day"
  employees ||--o{ regularizations : requests
  employees ||--o{ leave_requests : applies
  leave_types ||--o{ leave_requests : type
  leave_types ||--o{ leave_carry_forward : carry
  offices ||--o{ holidays : "null = all offices"
  offices ||--o{ payroll_runs : "null = whole org"
  payroll_runs ||--o{ payroll_lines : lines
  employees ||--o{ payroll_lines : paid
  channels ||--o{ channel_members : members
  channels ||--o{ messages : messages
  departments ||--o| channels : "department channel"
  employees ||--o{ todos : "owner / assigned_by"
  employees ||--o{ issues : reports
```

## 9. Security notes

- Every table has RLS; writes for leave, regularizations and payroll only via `security definer` functions (direct `update` revoked).
- `post_announcement`, `orphan_uploads`, `daily_reminders`, `hit_rate_limit` are not callable through the API.
- Uploads: browser → signed URL (10 MB bucket cap, MIME allowlist: images, video, PDF, Office, text/CSV, zip; no HTML/SVG); a path is only accepted if it starts with your employee id. Downloads are forced except images/videos (`?view`).
- Rate limit: `requireMe()` (every server action, `/files`, CSV exports) and the profile actions call `hit_rate_limit`: 120 per employee per minute, fixed window in `rate_limits`. Over the limit the action throws; `ActionForm` shows a "too many requests" message. IP-level limits: Vercel Firewall.
- CSP (`proxy.ts`, Clerk `contentSecurityPolicy.strict`): scripts only with the per-request nonce (`'strict-dynamic'`), so injected markup can't run script; connections/images limited to self, Clerk and the Supabase project; `frame-ancestors 'none'`. Other headers (HSTS, nosniff, referrer, permissions) in `next.config.ts`.
- Injection: queries go through supabase-js / RPC parameters, no SQL built from strings; free-text search strips PostgREST filter syntax; CSV exports neutralise spreadsheet formulas. Free-text columns have length caps in the schema.
- Cron route rejects requests unless `Authorization: Bearer $CRON_SECRET` matches (and refuses if the secret is unset).
- SEO: only `/sign-in` is indexable; production canonical origin is always `https://panel.openboxventures.in`.
- Tests: `npm run test:rls` runs `reset.sql → schema.sql` twice in PGlite and asserts the access rules; `node lib/payroll.check.mjs` checks the calculator.
