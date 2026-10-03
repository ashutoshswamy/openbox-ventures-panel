// Demo data across every feature and role: Clerk users (sign in as any role) + Supabase rows.
// Usage: npm run demo:seed     (re-runnable: unseeds first)
//        npm run demo:unseed
// Demo users: demo.<name>+clerk_test@example.com, password $DEMO_PASSWORD (default below).
// (Dev Clerk instance: "+clerk_test" emails also accept the verification code 424242.)
// Demo rows are found by those emails and the "Demo " office names; real data is left alone.
import { createClient } from "@supabase/supabase-js";

for (const k of ["CLERK_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"]) {
  if (!process.env[k]) throw new Error(`${k} missing (is .env.local filled in?)`);
}
const PASSWORD = process.env.DEMO_PASSWORD ?? "OpenBox-Demo-2026!";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

async function clerk(path, init = {}) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Clerk ${path}: ${body.errors?.map((e) => e.long_message ?? e.message).join("; ") ?? res.status}`);
  return body;
}

// supabase-js returns { data, error }; fail loudly
async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}

// ── Demo cast ─────────────────────────────────────────────────────────
// office: P = Pune, B = Bengaluru. clerk:false = invited, never signed up. role null = waiting for a role.
const OFFICES = {
  P: { name: "Demo Pune HQ", address: "Baner Road, Pune 411045", lat: 18.5590, lng: 73.7868, radius_m: 200 },
  B: { name: "Demo Bengaluru Studio", address: "100 Feet Road, Indiranagar, Bengaluru 560038", lat: 12.9719, lng: 77.6412, radius_m: 250, work_start: "10:00", work_end: "19:00" },
};
const DEPTS = { P: ["Engineering", "Design", "Operations"], B: ["Sales", "Engineering"] };
const PEOPLE = [
  { key: "admin",   name: "Riya Kapoor",    role: "admin" },
  { key: "arjun",   name: "Arjun Mehta",    role: "manager",  office: "P", dept: "Engineering", title: "Engineering Manager" },
  { key: "kavya",   name: "Kavya Iyer",     role: "manager",  office: "B", dept: "Sales",       title: "Sales Manager" },
  { key: "rohan",   name: "Rohan Desai",    role: "employee", office: "P", dept: "Engineering", title: "Software Engineer" },
  { key: "ananya",  name: "Ananya Rao",     role: "employee", office: "P", dept: "Engineering", title: "Frontend Engineer" },
  { key: "sneha",   name: "Sneha Kulkarni", role: "employee", office: "P", dept: "Design",      title: "Product Designer" },
  { key: "vikram",  name: "Vikram Joshi",   role: "employee", office: "P", dept: "Operations",  title: "Operations Executive" },
  { key: "karthik", name: "Karthik Nair",   role: "employee", office: "B", dept: "Sales",       title: "Account Executive" },
  { key: "farhan",  name: "Farhan Sheikh",  role: "employee", office: "B", dept: "Sales",       title: "Sales Associate" },
  { key: "meera",   name: "Meera Pillai",   role: "employee", office: "B", dept: "Engineering", title: "Backend Engineer" },
  { key: "isha",    name: "Isha Verma",     role: null,       office: "P", dept: "Design",      title: "UX Researcher", recent: true },
  { key: "dev",     name: "Dev Malhotra",   role: null,       office: "B", dept: "Sales",       title: "Sales Intern", clerk: false },
  { key: "neha",    name: "Neha Gupta",     role: "employee", office: "P", dept: "Operations",  title: "HR Executive", clerk: false, inactive: true },
];
const emailOf = (key) => `demo.${key}+clerk_test@example.com`;
const EMAIL_LIKE = "demo.%+clerk_test@example.com";
const LEAVE_TYPES = [
  { name: "Casual Leave", yearly_quota: 12 },
  { name: "Sick Leave", yearly_quota: 8, doc_required_after_days: 2 },
  { name: "Earned Leave", yearly_quota: 18, accrual: "monthly", carry_forward_max: 10, allow_half_day: false },
  { name: "Unpaid Leave", paid: false, yearly_quota: 0 },
];

// ── Dates (IST, as strings) ──────────────────────────────────────────
const IST_MS = 5.5 * 3600e3;
const TODAY = new Date(Date.now() + IST_MS).toISOString().slice(0, 10);
const YEAR = Number(TODAY.slice(0, 4));
const addDays = (d, n) => new Date(Date.parse(d) + n * 86400e3).toISOString().slice(0, 10);
const isWeekend = (d) => [0, 6].includes(new Date(d).getUTCDay());
const at = (d, hhmm) => `${d}T${hhmm}:00+05:30`;
const ago = (hours) => new Date(Date.now() - hours * 3600e3).toISOString();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const between = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
const weekday = (d) => { while (isWeekend(d)) d = addDays(d, 1); return d; };

// n-th working day from today (negative = past), skipping weekends + given holiday dates
function workday(n, holidays) {
  let d = TODAY;
  for (let left = Math.abs(n); left > 0; ) {
    d = addDays(d, Math.sign(n));
    if (!isWeekend(d) && !holidays.includes(d)) left--;
  }
  return d;
}

// ── Unseed ───────────────────────────────────────────────────────────
async function unseed() {
  const demo = await q(sb.from("employees").select("id").like("email", EMAIL_LIKE));
  const ids = demo.map((e) => e.id);
  if (ids.length) {
    await q(sb.from("messages").delete().in("sender_id", ids)); // sender_id is "set null" otherwise
    await q(sb.from("channels").delete().in("created_by", ids)); // DMs + groups (members/messages cascade)
    await q(sb.from("leave_requests").update({ reviewed_by: null }).in("reviewed_by", ids)); // no cascade on reviewer
    await q(sb.from("employees").delete().in("id", ids)); // cascades attendance, leave, profiles, issues, memberships
  }
  // offices cascade departments, department channels, holidays
  const names = Object.values(OFFICES).map((o) => o.name);
  await q(sb.from("offices").delete().in("name", names));
  // system announcements the triggers posted about demo offices/holidays
  for (const n of names) await q(sb.from("messages").delete().is("sender_id", null).like("body", `%${n}%`));
  // leave types only if nothing real uses them
  for (const t of LEAVE_TYPES) {
    const { error } = await sb.from("leave_types").delete().eq("name", t.name);
    if (error) console.log(`  kept leave type "${t.name}" (still referenced)`);
  }
  // Clerk users
  const qs = PEOPLE.map((p) => `email_address=${encodeURIComponent(emailOf(p.key))}`).join("&");
  const users = await clerk(`/users?limit=100&${qs}`);
  for (const u of users) await clerk(`/users/${u.id}`, { method: "DELETE" });
  console.log(`Unseeded: ${ids.length} employees, ${users.length} Clerk users, demo offices/leave types/chat.`);
}

// ── Seed ─────────────────────────────────────────────────────────────
async function seed() {
  await unseed();

  // Offices (trigger posts "New office" announcements) + departments (trigger creates department channels)
  const office = {};
  for (const [k, o] of Object.entries(OFFICES)) office[k] = (await q(sb.from("offices").insert(o).select().single())).id;
  const dept = {};
  for (const [k, names] of Object.entries(DEPTS)) {
    for (const d of await q(sb.from("departments").insert(names.map((name) => ({ office_id: office[k], name }))).select())) {
      dept[`${k}:${d.name}`] = d.id;
    }
  }

  // Holidays (office-scoped so they cascade on unseed; trigger announces each)
  const holidayRows = [
    { office_id: office.P, date: weekday(addDays(TODAY, -12)), name: "Founders' Day" },
    { office_id: office.B, date: weekday(addDays(TODAY, -12)), name: "Founders' Day" },
    { office_id: office.P, date: weekday(addDays(TODAY, 18)), name: "Festival Holiday" },
    { office_id: office.B, date: weekday(addDays(TODAY, 18)), name: "Festival Holiday" },
    { office_id: office.B, date: weekday(addDays(TODAY, 30)), name: "Karnataka Rajyotsava" },
  ];
  await q(sb.from("holidays").insert(holidayRows));
  const hol = holidayRows.map((h) => h.date);

  // Leave types (shared config: reuse if an admin already made one with the same name)
  await q(sb.from("leave_types").upsert(LEAVE_TYPES, { onConflict: "name", ignoreDuplicates: true, defaultToNull: false }));
  const lt = Object.fromEntries((await q(sb.from("leave_types").select("id, name").in("name", LEAVE_TYPES.map((t) => t.name)))).map((t) => [t.name.split(" ")[0], t.id]));

  // Clerk users + employee rows
  const emp = {};
  for (const p of PEOPLE) {
    const email = emailOf(p.key);
    let clerkId = null;
    if (p.clerk !== false) {
      const [first, ...rest] = p.name.split(" ");
      const u = await clerk("/users", {
        method: "POST",
        body: JSON.stringify({
          email_address: [email], first_name: first, last_name: rest.join(" "),
          password: PASSWORD, skip_password_checks: true,
          public_metadata: p.role ? { role: p.role } : {},
        }),
      });
      clerkId = u.id;
    }
    const row = await q(sb.from("employees").insert({
      email, full_name: p.name, clerk_user_id: clerkId, role: p.role, active: !p.inactive,
      office_id: p.office ? office[p.office] : null,
      department_id: p.dept ? dept[`${p.office}:${p.dept}`] : null,
      designation: p.title ?? null,
      joined_on: p.clerk === false && !p.inactive ? null : addDays(TODAY, p.recent ? -2 : -between(120, 900)),
    }).select().single());
    emp[p.key] = { ...p, ...row };
  }
  const staff = Object.values(emp).filter((e) => e.role && e.role !== "admin" && e.active); // attendance + leave users

  // Onboarding profiles: everyone who signed up and isn't an admin (else they're sent to /profile)
  const bloods = ["A+", "B+", "O+", "AB+", "O-"];
  await q(sb.from("employee_profiles").insert(Object.values(emp).filter((e) => e.clerk_user_id && e.role !== "admin").map((e, i) => ({
    employee_id: e.id,
    date_of_birth: `${between(1988, 2002)}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 28)).padStart(2, "0")}`,
    gender: i % 2 ? "Female" : "Male",
    phone: `+91 98${String(between(10000000, 99999999))}`,
    personal_email: `${e.key}.personal@example.com`,
    blood_group: pick(bloods),
    current_address: e.office === "P" ? `Flat ${between(101, 904)}, Aundh, Pune` : `${between(1, 40)} 2nd Cross, HSR Layout, Bengaluru`,
    emergency_name: "Parent of " + e.full_name.split(" ")[0],
    emergency_relation: pick(["Father", "Mother", "Spouse", "Sibling"]),
    emergency_phone: `+91 99${String(between(10000000, 99999999))}`,
  }))));

  // Leave requests: every status, both offices, managers' own leave reviewed by the admin
  const L = (key, type, s, e, extra = {}) => {
    const days = extra.half_day ? 0.5 : Array.from({ length: (Date.parse(e) - Date.parse(s)) / 86400e3 + 1 }, (_, i) => addDays(s, i))
      .filter((d) => !isWeekend(d) && !hol.includes(d)).length;
    return { employee_id: emp[key].id, leave_type_id: lt[type], start_date: s, end_date: e, days, created_at: ago(between(24, 24 * 20)), ...extra };
  };
  const reviewed = (by, status, note) => ({ status, reviewed_by: emp[by].id, reviewed_at: ago(between(2, 72)), review_note: note ?? null });
  const leaves = [
    L("rohan", "Casual", workday(-6, hol), workday(-6, hol), { reason: "Family function", ...reviewed("arjun", "approved") }),
    L("sneha", "Earned", workday(5, hol), workday(7, hol), { reason: "Trip to Goa" }),
    L("vikram", "Casual", workday(2, hol), workday(3, hol), { reason: "Personal work", ...reviewed("arjun", "rejected", "Quarter-end close, please pick another week") }),
    L("ananya", "Sick", workday(1, hol), workday(1, hol), { half_day: true, reason: "Doctor's appointment" }),
    L("karthik", "Earned", workday(8, hol), workday(9, hol), { reason: "Sister's wedding", ...reviewed("kavya", "approved", "Enjoy!") }),
    L("meera", "Casual", workday(4, hol), workday(4, hol), { reason: "Bank work", status: "cancelled" }),
    L("farhan", "Unpaid", workday(10, hol), workday(10, hol), { reason: "Exam" }),
    L("meera", "Sick", workday(-3, hol), workday(-2, hol), { reason: "Viral fever", ...reviewed("kavya", "approved", "Get well soon") }),
    L("arjun", "Casual", workday(6, hol), workday(6, hol), { reason: "Moving house" }),
    L("kavya", "Sick", workday(-9, hol), workday(-9, hol), { reason: "Migraine", ...reviewed("admin", "approved") }),
  ];
  await q(sb.from("leave_requests").insert(leaves, { defaultToNull: false }));
  await q(sb.from("leave_carry_forward").insert(["rohan", "sneha", "karthik", "arjun"].map((k) => ({
    employee_id: emp[k].id, leave_type_id: lt.Earned, year: YEAR, days: between(2, 8),
  }))));

  // Attendance: last ~30 days; office check-ins near the office, some WFH, some late, a few absences.
  // Today (if a working day): checked in, not out yet.
  const onLeave = new Set(leaves.filter((l) => l.status === "approved").flatMap((l) => {
    const out = [];
    for (let d = l.start_date; d <= l.end_date; d = addDays(d, 1)) out.push(`${l.employee_id}:${d}`);
    return out;
  }));
  const attendance = [];
  for (const e of staff) {
    const o = OFFICES[e.office];
    const start = Number((o.work_start ?? "09:30").slice(0, 2)) * 60 + Number((o.work_start ?? "09:30").slice(3));
    for (let i = 30; i >= 0; i--) {
      const d = addDays(TODAY, -i);
      if (isWeekend(d) || hol.includes(d) || onLeave.has(`${e.id}:${d}`) || Math.random() < 0.06) continue;
      const mode = Math.random() < 0.2 ? "wfh" : "office";
      const inMin = start - 25 + between(0, Math.random() < 0.15 ? 75 : 35); // ~15% late past grace
      attendance.push({
        employee_id: e.id, date: d, mode,
        check_in_at: at(d, hhmm(inMin)),
        check_out_at: i === 0 ? null : at(d, hhmm(inMin + between(8 * 60 - 30, 9 * 60 + 45))),
        check_in_lat: mode === "office" ? o.lat + (Math.random() - 0.5) * 0.001 : null,
        check_in_lng: mode === "office" ? o.lng + (Math.random() - 0.5) * 0.001 : null,
        note: mode === "wfh" && Math.random() < 0.3 ? "Internet technician visit at home" : null,
      });
    }
  }
  // check-in time for today may be in the future early in the morning; keep it valid
  for (const a of attendance) if (a.date === TODAY && Date.parse(a.check_in_at) > Date.now()) a.check_in_at = new Date().toISOString();
  await q(sb.from("attendance").insert(attendance));

  // Issues: open + resolved
  await q(sb.from("issues").insert([
    { employee_id: emp.vikram.id, subject: "VPN keeps disconnecting", body: "Since Monday the office VPN drops every 20 minutes.", created_at: ago(30) },
    { employee_id: emp.arjun.id, subject: "Wrong office hours for Pune", body: "Check-ins after 9:45 show as late, but our team starts at 10 on Fridays.", created_at: ago(5) },
    { employee_id: emp.meera.id, subject: "Can't upload leave document", body: "Upload spinner never finishes for a 3 MB PDF.", status: "resolved",
      admin_note: "Bucket limit was misconfigured, fixed. Please retry.", resolved_by: emp.admin.id, resolved_at: ago(20), created_at: ago(70) },
  ], { defaultToNull: false }));

  // Chat. Admins aren't chat members, but they post announcements.
  const announcements = (await q(sb.from("channels").select("id").eq("announcements", true).single())).id;
  const deptChannel = Object.fromEntries((await q(sb.from("channels").select("id, department_id").in("department_id", Object.values(dept))))
    .map((c) => [Object.keys(dept).find((k) => dept[k] === c.department_id), c.id]));
  const channel = async (type, name, by, members) => {
    const c = await q(sb.from("channels").insert({ type, name, created_by: emp[by].id }).select().single());
    // last read 2 days ago → recent messages show as unread
    await q(sb.from("channel_members").insert(members.map((k) => ({ channel_id: c.id, employee_id: emp[k].id, last_read_at: ago(48) }))));
    return c.id;
  };
  const group = await channel("group", "Website Revamp", "arjun", ["arjun", "sneha", "rohan", "meera"]);
  const dm1 = await channel("dm", null, "rohan", ["rohan", "ananya"]);
  const dm2 = await channel("dm", null, "kavya", ["kavya", "arjun"]);

  // [channel, sender, body, hours ago]
  const convo = [
    [announcements, "admin", "Welcome to the new Open Box Ventures LLP panel! Attendance, leave and chat now live in one place.", 120],
    [announcements, "admin", "Reminder: submit your leave plans for the festive season by the end of next week.", 26],
    [announcements, "arjun", "Pune team: townhall on Friday at 4 pm in the main conference room.", 6],
    [deptChannel["P:Engineering"], "arjun", "Standup moved to 10:15 today.", 50],
    [deptChannel["P:Engineering"], "rohan", "Noted. PR for the attendance export is up for review.", 49],
    [deptChannel["P:Engineering"], "ananya", "I'll take a look after lunch.", 47],
    [deptChannel["P:Engineering"], "arjun", "Release freeze starts Wednesday, please merge by Tuesday EOD.", 3],
    [deptChannel["P:Design"], "sneha", "New brand colours are in the shared drive.", 30],
    [deptChannel["B:Sales"], "kavya", "Great quarter, team! Pipeline review tomorrow at 11.", 28],
    [deptChannel["B:Sales"], "karthik", "Closed the Acme renewal 🎉", 27],
    [deptChannel["B:Sales"], "farhan", "Congrats! Sharing the updated deck in a bit.", 2],
    [deptChannel["B:Engineering"], "meera", "Staging DB migration done, all green.", 8],
    [group, "arjun", "Kicking off the website revamp. Sneha owns design, Rohan + Meera on build.", 72],
    [group, "sneha", "First mockups by Thursday.", 70],
    [group, "meera", "I'll set up the new CMS on staging.", 40],
    [group, "sneha", "Mockups are up, feedback welcome!", 4],
    [dm1, "rohan", "Hey, can you pair on the date picker bug?", 25],
    [dm1, "ananya", "Sure, after standup?", 24],
    [dm1, "rohan", "Perfect 👍", 1],
    [dm2, "kavya", "Can your team help with a demo for a Bengaluru client next week?", 10],
    [dm2, "arjun", "Yes, send me the details.", 9],
  ];
  await q(sb.from("messages").insert(convo.map(([channel_id, by, body, h]) => ({ channel_id, sender_id: emp[by].id, body, created_at: ago(h) }))));

  console.log(`\nSeeded demo data. Password for all demo logins: ${PASSWORD}\n`);
  for (const p of PEOPLE) {
    const state = p.inactive ? "deactivated" : p.clerk === false ? "invited, not signed up" : p.role ?? "waiting for role";
    console.log(`  ${state.padEnd(22)} ${p.name.padEnd(15)} ${p.clerk === false ? "-" : emailOf(p.key)}`);
  }
}

const cmd = process.argv[2];
if (cmd === "seed") await seed();
else if (cmd === "unseed") await unseed();
else { console.error("Usage: node --env-file=.env.local scripts/demo-data.mjs seed|unseed"); process.exit(1); }
