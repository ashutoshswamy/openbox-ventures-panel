// RLS smoke test against in-memory Postgres (PGlite). Run: npm run test:rls
// Stubs Supabase's auth.jwt() + authenticated role, applies schema.sql (and reset.sql), asserts access rules.
import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import fs from "node:fs";

const db = new PGlite();
await db.exec(`
  create role authenticated; create schema auth;
  create table auth._claims(sub text, role text);
  create function auth.jwt() returns jsonb language sql stable
    as $$ select jsonb_build_object('sub', sub, 'metadata', jsonb_build_object('role', role)) from auth._claims limit 1 $$;
  create publication supabase_realtime;
  -- like Supabase: API roles get table privileges by default; schema.sql narrows them
  create role anon;
  grant usage on schema public, auth to authenticated, anon;
  grant select on auth._claims to authenticated, anon;
  alter default privileges in schema public grant all on tables to authenticated, anon;`);
// reset → schema → reset → schema: both scripts must run cleanly on a used DB
const schema = fs.readFileSync("supabase/schema.sql", "utf8");
const reset = fs.readFileSync("supabase/reset.sql", "utf8");
await db.exec(schema);
await db.exec(reset);
await db.exec(schema);
await db.exec(`
  insert into offices(id, name) values
    ('00000000-0000-0000-0000-00000000000a', 'Pune'),
    ('00000000-0000-0000-0000-00000000000b', 'Mumbai');
  insert into employees(email, full_name, office_id, clerk_user_id) values
    ('a@x.com',  'Admin', null, 'u_admin'),
    ('m@x.com',  'Mgr',   '00000000-0000-0000-0000-00000000000a', 'u_mgr'),
    ('e1@x.com', 'E1',    '00000000-0000-0000-0000-00000000000a', 'u_e1'),
    ('e2@x.com', 'E2',    '00000000-0000-0000-0000-00000000000b', 'u_e2');
  insert into attendance(employee_id, date, mode) select id, current_date, 'office' from employees;
  insert into employees(email, full_name, office_id, clerk_user_id) values ('h@x.com', 'HR', '00000000-0000-0000-0000-00000000000a', 'u_hr');
  update employees set role = case email when 'a@x.com' then 'admin' when 'm@x.com' then 'manager' when 'h@x.com' then 'hr' else 'employee' end;
  insert into leave_types(name) values ('Casual');
  insert into leave_requests(employee_id, leave_type_id, start_date, end_date, days)
    select e.id, t.id, current_date, current_date, 1 from employees e, leave_types t where e.email in ('e1@x.com', 'm@x.com');`);

// role = Clerk publicMetadata.role carried in the JWT
const roles = { u_admin: "admin", u_mgr: "manager", u_e1: "employee", u_e2: "employee", u_hr: "hr" };
async function as(sub, sql, role = roles[sub] ?? null) {
  await db.exec(`reset role; delete from auth._claims; insert into auth._claims values ('${sub}', ${role ? `'${role}'` : "null"}); set role authenticated;`);
  try {
    return (await db.query(sql)).rows.map((r) => Object.values(r)[0]).join(",");
  } catch {
    return "ERR";
  }
}

const att = "select e.email from attendance a join employees e on e.id = a.employee_id order by 1";
assert.equal(await as("u_e1", att), "e1@x.com");
assert.equal(await as("u_mgr", att), "e1@x.com,m@x.com");
assert.equal(await as("u_admin", att), "a@x.com,e1@x.com,e2@x.com,m@x.com");
assert.equal(await as("u_nobody", att), "");
assert.equal(await as("u_nobody", "select email from employees"), "");
assert.equal(await as("u_nobody", att, "admin"), "", "admin claim without employee row = nothing");
assert.equal(await as("u_e1", att, null), "", "no role assigned = no access");
assert.equal(await as("u_e1", "select count(*) from employees", null), "0");

assert.equal(await as("u_e1", "insert into attendance(employee_id, date, mode) select id, current_date + 1, 'wfh' from employees where email = 'e1@x.com'"), "ERR");
assert.equal(await as("u_e1", "update offices set name = 'x' returning name"), "");
assert.equal(await as("u_e1", "insert into leave_types(name) values ('Free')"), "ERR");

const apply = (status) =>
  `insert into leave_requests(employee_id, leave_type_id, start_date, end_date, days, status)
   select e.id, t.id, current_date, current_date, 1, '${status}' from employees e, leave_types t where e.email = 'e1@x.com' returning status`;
assert.equal(await as("u_e1", apply("approved")), "ERR");
assert.equal(await as("u_e1", apply("pending")), "ERR", "inserts only via apply_leave()");

// two-step review: manager → manager_approved → HR final; all via review_leave()
const review = (email, ok = true) =>
  `select review_leave((select id from leave_requests where status in ('pending', 'manager_approved') and employee_id = (select id from employees where email = '${email}') limit 1), ${ok})`;
const lstatus = (email) => `select status from leave_requests where employee_id = (select id from employees where email = '${email}') limit 1`;
assert.equal(await as("u_e1", "update leave_requests set status = 'approved' returning status"), "ERR", "no direct updates");
assert.equal(await as("u_mgr", "update leave_requests set status = 'approved' returning status"), "ERR", "no direct updates, even for managers");
assert.equal(await as("u_e1", review("e1@x.com")), "ERR", "employee can't review");
assert.equal(await as("u_e2", review("e1@x.com")), "ERR", "other office can't review");
assert.equal(await as("u_mgr", review("m@x.com")), "ERR", "manager must not self-approve");
assert.equal(await as("u_hr", review("e1@x.com")), "ERR", "HR waits for the manager when the office has one");
assert.equal(await as("u_mgr", review("e1@x.com")), "");
assert.equal(await as("u_e1", lstatus("e1@x.com")), "manager_approved");
assert.equal(await as("u_mgr", review("e1@x.com")), "ERR", "manager can't finalize");
assert.equal(await as("u_hr", review("e1@x.com")), "");
assert.equal(await as("u_e1", lstatus("e1@x.com")), "approved");
assert.equal(await as("u_hr", review("e1@x.com")), "ERR", "already reviewed");
assert.equal(await as("u_hr", review("m@x.com")), "", "HR finalizes a manager's leave directly");
assert.equal(await as("u_mgr", lstatus("m@x.com")), "approved");

assert.equal(await as("u_e1", "insert into channels(name, type, created_by) select 'c', 'group', id from employees where email = 'e1@x.com' returning name"), "c");

// ── attendance RPCs ──
await db.exec(`reset role;
  update offices set lat = 18.5204, lng = 73.8567, radius_m = 200;
  delete from attendance;`);
const err = async (sub, sql) => {
  await as(sub, "select 1");
  try { await db.query(sql); return "ok"; } catch (e) { return e.message; }
};
assert.match(await err("u_e1", "select check_in('office')"), /Location is required/);
assert.match(await err("u_e1", "select check_in('office', 18.5300, 73.8567)"), /must be within 200 m/); // ~1 km away
assert.equal(await err("u_e1", "select check_in('office', 18.5210, 73.8567)"), "ok"); // ~70 m away
assert.match(await err("u_e1", "select check_in('wfh')"), /Already checked in/);
assert.equal(await err("u_e2", "select check_in('wfh')"), "ok");
assert.equal(await err("u_e1", "select check_out()"), "ok");
assert.match(await err("u_e1", "select check_out()"), /No open check-in/);
assert.equal(await as("u_e1", "select mode from attendance_report"), "office");

// ── leave RPCs ──
await db.exec(`reset role;
  delete from leave_requests;
  update leave_types set yearly_quota = 2, accrual = 'yearly', carry_forward_max = 5, allow_half_day = true;
  update offices set work_days = '{1,2,3,4,5,6,7}';
  insert into holidays(date, name) values ('2030-01-02', 'Test holiday');`);
const typeId = await as("u_admin", "select id from leave_types limit 1");
const y = new Date().getFullYear();
const leave = (s, e, half = false) => `select days from apply_leave('${typeId}', '${s}', '${e}', ${half})`;
assert.equal(await as("u_e1", "select leave_days((select id from employees where email = 'e1@x.com'), '2030-01-01', '2030-01-03', false)"), "2", "holiday excluded");
assert.equal(await as("u_e1", leave(`${y}-12-01`, `${y}-12-01`, true)), "0.5");
assert.match(await err("u_e1", leave(`${y}-12-01`, `${y}-12-01`)), /Overlaps/);
assert.match(await err("u_e1", leave(`${y}-12-10`, `${y}-12-14`)), /Not enough Casual balance: 1.5 available/);
assert.equal(await as("u_e1", leave(`${y}-12-10`, `${y}-12-10`)), "1.0");
assert.equal(await as("u_e1", "select balance from leave_balances"), "2.0", "pending not deducted from balance");
assert.equal(await as("u_e2", "select count(*) from leave_balances"), "1", "only own balance");
assert.equal(await err("u_e1", `select cancel_leave((select id from leave_requests where start_date = '${y}-12-10'))`), "ok");
assert.match(await err("u_e2", `select cancel_leave((select id from leave_requests where start_date = '${y}-12-01'))`), /Only your own/);
assert.equal(await as("u_mgr", review("e1@x.com")), "");
assert.equal(await as("u_e1", "select sum(pending) from leave_balances"), "0.5", "manager_approved still counts as pending");
assert.match(await err("u_e1", leave(`${y}-12-01`, `${y}-12-01`, true)), /Overlaps/);
assert.equal(await as("u_hr", review("e1@x.com")), "");
assert.match(await err("u_e1", `select close_year(${y})`), /Admins only/);
assert.equal(await err("u_admin", `select close_year(${y})`), "ok");
await db.exec("reset role");
assert.equal((await db.query(`select days from leave_carry_forward cf join employees e on e.id = cf.employee_id where e.email = 'e1@x.com'`)).rows[0].days, "1.5");

// ── attendance regularization: 5/month, HR approves ──
const reg = (d) => `select request_regularization('${d}', 'office', '09:30', '18:30', 'forgot to check in')`;
for (let d = 1; d <= 5; d++) assert.equal(await err("u_e1", reg(`${y - 1}-03-0${d}`)), "ok");
assert.match(await err("u_e1", reg(`${y - 1}-03-09`)), /limit reached: 5 per month/);
assert.equal(await err("u_e1", reg(`${y - 1}-04-01`)), "ok", "limit is per month");
assert.match(await err("u_e1", reg(`${y - 1}-04-01`)), /already have/);
assert.match(await err("u_e1", reg(`${y + 1}-01-01`)), /future/);
assert.equal(await as("u_e2", "select count(*) from regularizations"), "0", "others' requests hidden");
assert.equal(await as("u_e1", "insert into regularizations(employee_id, date, mode, check_in_at, check_out_at, reason) select employee_id, date + 100, mode, check_in_at, check_out_at, 'x' from regularizations limit 1 returning id"), "ERR", "no direct insert");
const regId = await as("u_e1", `select id from regularizations where date = '${y - 1}-03-01'`);
assert.match(await err("u_mgr", `select review_regularization('${regId}', true)`), /Only HR/);
assert.match(await err("u_e1", `select review_regularization('${regId}', true)`), /Only HR/);
assert.equal(await err("u_hr", `select review_regularization('${regId}', true)`), "ok");
assert.match(await err("u_hr", `select review_regularization('${regId}', false)`), /already reviewed/);
assert.equal(await as("u_e1", `select mode from attendance where date = '${y - 1}-03-01'`), "office", "approval writes attendance");
await db.exec("reset role");

// ── chat ──
await db.exec(`reset role; insert into departments(office_id, name) values ('00000000-0000-0000-0000-00000000000a', 'Eng');
  update employees set department_id = (select id from departments) where email = 'e1@x.com';`);
assert.equal(await as("u_e1", "select name from my_channels() where type = 'department'"), "Eng", "dept channel auto + implicit member");
assert.equal(await as("u_e2", "select count(*) from my_channels() where type = 'department'"), "0");
await as("u_admin", "update departments set name = 'Engineering' where name = 'Eng' returning id");
assert.equal(await as("u_e1", "select name from my_channels() where type = 'department'"), "Engineering", "dept rename renames its channel");
await as("u_admin", "update departments set name = 'Eng' where name = 'Engineering' returning id");
const dm = await as("u_e1", "select dm_with((select id from employees where email = 'e2@x.com'))");
assert.equal(await as("u_e2", "select dm_with((select id from employees where email = 'e1@x.com'))"), dm, "DM reused");
assert.equal(await err("u_e1", `insert into messages(channel_id, sender_id, body) values ('${dm}', (select id from employees where email = 'e1@x.com'), 'hi')`), "ok");
assert.equal(await as("u_e2", "select name || ':' || unread from my_channels() where type = 'dm'"), "E1:1");
assert.equal(await as("u_mgr", `select count(*) from messages where channel_id = '${dm}'`), "0", "non-members can't read");
assert.match(await err("u_mgr", `insert into messages(channel_id, sender_id, body) values ('${dm}', (select id from employees where email = 'm@x.com'), 'x')`), /row-level security/);

// ── no chatting with admins ──
await db.exec("reset role; update employees set role = 'admin' where email = 'a@x.com'");
const adminId = (await db.query("select id from employees where email = 'a@x.com'")).rows[0].id;
assert.match(await err("u_e1", `select dm_with('${adminId}')`), /Admins can't be messaged/);
const grp = await as("u_e1", "insert into channels(name, type, created_by) select 'g', 'group', id from employees where email = 'e1@x.com' returning id");
assert.match(await err("u_e1", `insert into channel_members(channel_id, employee_id) values ('${grp}', '${adminId}')`), /row-level security/);

// ── admins are anonymous: invisible to everyone but admins ──
for (const u of ["u_e1", "u_mgr", "u_hr"]) assert.equal(await as(u, "select count(*) from employees where role = 'admin'"), "0", `${u} can't see admins`);
assert.equal(await as("u_admin", "select count(*) from employees where role = 'admin'"), "1");
assert.equal(await err("u_e1", `insert into channel_members(channel_id, employee_id) select '${grp}', id from employees where email in ('e1@x.com', 'e2@x.com')`), "ok");

// ── calls: members only, functions only ──
const room = "abcdef123456";
assert.equal(await err("u_mgr", `select start_call('${grp}', '${room}')`), "Not allowed", "non-member can't start");
assert.equal(await err("u_e1", `select start_call('${grp}', 'bad')`) === "ok", false, "room format checked");
assert.equal(await err("u_e1", `select start_call('${grp}', '${room}')`), "ok");
assert.equal(await err("u_e2", `select call_ping('${room}')`), "ok");
assert.equal(await err("u_e2", `select call_ping('${room}')`), "ok", "re-ping = heartbeat");
assert.equal(await as("u_e1", "select count(*) from call_participants"), "2");
assert.equal(await as("u_mgr", "select count(*) from calls"), "0", "non-members see no calls");
assert.equal(await err("u_mgr", `select call_ping('${room}')`), "Not allowed");
assert.match(await err("u_e1", `insert into calls(channel_id, room) values ('${grp}', '000000000000')`), /permission denied/);
assert.match(await err("u_e1", "update call_participants set last_seen_at = now() + interval '1 day'"), /permission denied/);
assert.equal(await err("u_e2", `select end_call('${room}')`), "ok");
assert.equal(await as("u_e1", "select ended_at is not null from calls"), "true");

// ── issues ──
const report = (sub, extra = "") =>
  as(sub, `insert into issues(employee_id, subject, body${extra ? ", status" : ""}) select id, 'VPN down', 'Cannot connect'${extra} from employees where clerk_user_id = '${sub}' returning subject`);
assert.equal(await report("u_e1"), "VPN down");
assert.equal(await report("u_mgr"), "VPN down");
assert.equal(await report("u_e1", ", 'resolved'"), "ERR", "can't file as resolved");
assert.equal(await as("u_e1", "select count(*) from issues"), "1", "own issues only");
assert.equal(await as("u_mgr", "select count(*) from issues"), "1", "managers don't see others' issues");
assert.equal(await as("u_admin", "select count(*) from issues"), "2");
assert.equal(await as("u_e1", "update issues set status = 'resolved' returning status"), "", "reporter can't resolve");
assert.equal(await as("u_admin", "update issues set status = 'resolved', admin_note = 'fixed' returning status"), "resolved,resolved");

// ── todos ──
const todo = (sub, owner, assigned = false) =>
  as(sub, `insert into todos(owner_id, assigned_by, title) select o.id, ${assigned ? "(select id from me())" : "null"}, 't'
    from employees o where o.email = '${owner}' returning title`);
assert.equal(await todo("u_e1", "e1@x.com"), "t", "own personal todo");
assert.equal(await todo("u_e1", "e2@x.com"), "ERR", "no personal todo on someone else's list");
assert.equal(await todo("u_e1", "e2@x.com", true), "ERR", "employees can't assign");
assert.equal(await todo("u_mgr", "e1@x.com", true), "t", "manager assigns in own office");
assert.equal(await todo("u_mgr", "e2@x.com", true), "ERR", "not to other offices");
assert.equal(await todo("u_admin", "e2@x.com", true), "t", "admin assigns anyone");
assert.equal(await as("u_e1", "select count(*) from todos"), "2");
assert.equal(await as("u_mgr", "select count(*) from todos"), "1", "assigner sees what they assigned");
assert.equal(await as("u_e2", "select count(*) from todos"), "1");
assert.equal(await as("u_e1", "update todos set done_at = now() where assigned_by is not null returning title"), "t", "assignee can finish");
assert.equal(await as("u_e1", "delete from todos where assigned_by is not null returning title"), "", "assignee can't delete assigned");
assert.equal(await as("u_e1", "update todos set owner_id = owner_id returning title"), "ERR", "can't move todos");
assert.equal(await as("u_mgr", "delete from todos returning title"), "t", "assigner can withdraw");

// ── admins aren't employees ──
assert.match(await err("u_admin", "select check_in('wfh')"), /Admins don't use attendance/);
assert.match(await err("u_admin", `select apply_leave('${typeId}', '${y}-12-20', '${y}-12-20', false)`), /Admins don't use attendance/);

// ── onboarding profiles: own + admin only ──
await db.exec(`reset role; insert into employee_profiles(employee_id, date_of_birth, phone, current_address, emergency_name, emergency_relation, emergency_phone)
  select id, '1995-05-05', '9999999999', 'Pune', 'Mom', 'Mother', '8888888888' from employees where email in ('e1@x.com', 'e2@x.com')`);
assert.equal(await as("u_e1", "select count(*) from employee_profiles"), "1", "own profile only");
assert.equal(await as("u_mgr", "select count(*) from employee_profiles"), "0", "managers can't read personal details");
assert.equal(await as("u_admin", "select count(*) from employee_profiles"), "2");
assert.equal(await as("u_e1", "update employee_profiles set phone = '1' returning phone"), "1");
assert.equal(await as("u_e1", "insert into employee_profiles(employee_id, date_of_birth, phone, current_address, emergency_name, emergency_relation, emergency_phone) select id, '1990-01-01', 'x', 'x', 'x', 'x', 'x' from employees where email = 'm@x.com'"), "ERR");

// ── Announcements channel ──
const annId = await as("u_admin", "select id from channels where announcements");
const post = (sub) => `insert into messages(channel_id, sender_id, body) select '${annId}', id, 'hello all' from employees where clerk_user_id = '${sub}' returning body`;
assert.equal(await as("u_e1", post("u_e1")), "ERR", "employees can't post announcements");
assert.equal(await as("u_mgr", post("u_mgr")), "hello all", "managers post announcements");
assert.equal(await as("u_admin", post("u_admin")), "hello all");
assert.match(await as("u_e2", `select body from messages where channel_id = '${annId}'`), /New office: Pune.*hello all/, "everyone reads, incl. automated posts");
assert.equal(await as("u_e2", "select name from my_channels() limit 1"), "Announcements", "pinned first");
assert.equal(await as("u_e1", `insert into channel_members(channel_id, employee_id) select '${annId}', id from employees where email = 'e1@x.com' returning channel_id`), annId, "read marker row");
await db.exec("reset role; insert into holidays(date, name) values ('2031-01-26', 'Republic Day')");
assert.match(await as("u_e1", `select body from messages where channel_id = '${annId}' and sender_id is null`), /Holiday added: Republic Day on Sunday, 26 Jan 2031/);
await db.exec(`reset role; insert into employees(email, full_name, joined_on) values ('new@x.com', 'Neha New', current_date), ('old@x.com', 'Olu Old', null);
  update employees set role = 'employee' where email in ('new@x.com', 'old@x.com');`);
assert.equal(await as("u_e1", `select count(*) from messages where channel_id = '${annId}' and body like 'Please welcome%'`), "1", "only recent joiners welcomed");
assert.equal(await as("u_e1", `delete from messages where channel_id = '${annId}' returning id`), "", "employees can't delete");
assert.equal(await as("u_mgr", `delete from messages where channel_id = '${annId}' and sender_id is null returning id`), "", "managers can't delete others' posts");
assert.notEqual(await as("u_mgr", `delete from messages where channel_id = '${annId}' and sender_id = (select id from employees where email = 'm@x.com') returning id`), "", "managers delete own posts");
assert.notEqual(await as("u_admin", `delete from messages where channel_id = '${annId}' and sender_id is null returning id`), "");

// org chart: reports_to cycle guard + deactivated visibility
await db.exec(`reset role; insert into employees(email, full_name, office_id, active) values ('gone@x.com', 'Gone', '00000000-0000-0000-0000-00000000000a', false)`);
assert.equal(await as("u_e1", "select count(*) from employees where email = 'gone@x.com'"), "0", "employees don't see deactivated");
assert.equal(await as("u_mgr", "select count(*) from employees where email = 'gone@x.com'"), "1", "manager sees own-office deactivated");
assert.equal(await as("u_hr", "select count(*) from employees where email = 'gone@x.com'"), "1", "HR sees own-office deactivated");
assert.equal(await as("u_e2", "select count(*) from employees where email = 'gone@x.com'"), "0", "other office can't");
assert.equal(await as("u_admin", "select count(*) from employees where email = 'gone@x.com'"), "1");
await db.exec(`reset role; update employees set reports_to = (select id from employees where email = 'm@x.com') where email = 'e1@x.com'`);
assert.equal(await err("u_admin", `update employees set reports_to = (select id from employees where email = 'e1@x.com') where email = 'm@x.com'`), "Reporting line would form a cycle", "2-cycle rejected");
assert.equal(await err("u_admin", `update employees set reports_to = id where email = 'm@x.com'`), "Reporting line would form a cycle", "self-report rejected");
assert.equal(await as("u_e1", `update employees set reports_to = null where email = 'e1@x.com' returning id`), "", "employees can't edit reporting lines");
await db.exec(`reset role; update employees set reports_to = null; delete from employees where email = 'gone@x.com'`);

// ── holiday import + daily reminders ──
{
  const rows = `'[{"date":"2032-01-01","name":"NY","office_id":null},{"date":"2032-01-01","name":"NY","office_id":null},{"date":"2031-01-26","name":"Republic Day","office_id":null},{"date":"2032-02-02","name":"Local","office_id":"00000000-0000-0000-0000-00000000000a"}]'::jsonb`;
  assert.equal(await as("u_e1", `select import_holidays(${rows})`), "ERR", "employees can't import");
  assert.equal(await as("u_mgr", `select import_holidays(${rows})`), "ERR", "managers can't import");
  assert.equal(await as("u_nobody", `select import_holidays(${rows})`, null), "ERR");
  const before = await as("u_e1", `select count(*) from messages where channel_id = '${annId}'`);
  assert.equal(await as("u_admin", `select import_holidays(${rows})`), "2", "dupes (in batch and existing) skipped");
  assert.equal(await as("u_e1", `select count(*) from messages where channel_id = '${annId}'`), String(Number(before) + 1), "one summary post, not one per row");
  assert.equal(await as("u_admin", `select import_holidays(${rows})`), "0", "re-import inserts nothing");
  assert.equal(await as("u_e1", `select count(*) from messages where channel_id = '${annId}'`), String(Number(before) + 1), "no post when nothing new");
  assert.equal(await as("u_admin", `select import_holidays('[{"date":"2032-03-03","name":"X"},{"date":"bad","name":"Y"}]'::jsonb)`), "ERR");
  assert.equal(await as("u_admin", `select count(*) from holidays where name = 'X'`), "0", "all-or-nothing");

  // reminders
  assert.equal(await as("u_admin", "select daily_reminders()"), "ERR", "server-only");
  assert.equal(await as("u_e1", "select daily_reminders()"), "ERR");
  await db.exec(`reset role;
    update employee_profiles set date_of_birth = (now() at time zone 'Asia/Kolkata')::date - interval '30 years' where employee_id = (select id from employees where email = 'e1@x.com');
    update employees set joined_on = (now() at time zone 'Asia/Kolkata')::date - interval '2 years' where email = 'e2@x.com';
    insert into holidays(date, name) values ((now() at time zone 'Asia/Kolkata')::date + 1, 'Tomorrow Day');`);
  const n = Number((await db.query("select daily_reminders() as n")).rows[0].n);
  assert.equal(n, 3, "birthday + anniversary + holiday eve");
  assert.equal((await db.query("select daily_reminders() as n")).rows[0].n, 0, "idempotent per day");
  const msgs = (await db.query("select body from messages where sender_id is null and (body like 'Happy birthday%' or body like 'Congratulations%' or body like 'Reminder:%')")).rows.map((r) => r.body).join("|");
  assert.match(msgs, /Happy birthday, E1!/);
  assert.match(msgs, /Congratulations E2 on 2 years/);
  assert.match(msgs, /Reminder: tomorrow is Tomorrow Day/);
  assert.ok(!/\d{4}/.test(msgs.split("|").find((m) => m.startsWith("Happy"))), "no age/year in birthday post");
  assert.equal((await db.query("select reminder_match('2024-02-29', '2031-02-28') a, reminder_match('2024-02-29', '2032-02-28') b, reminder_match('2024-02-29', '2032-02-29') c")).rows[0].a, true, "Feb 29 -> Feb 28 on non-leap years");
  const m = (await db.query("select reminder_match('2024-02-29', '2032-02-28') b, reminder_match('2024-02-29', '2032-02-29') c")).rows[0];
  assert.deepEqual([m.b, m.c], [false, true], "leap years keep Feb 29");
}

// ── payroll: salary privacy, sheet flow, role gates ──
const e1 = "(select id from employees where email = 'e1@x.com')", e2 = "(select id from employees where email = 'e2@x.com')";
assert.equal(await err("u_hr", `select add_salary(${e1}, 600000, '2026-04-01', 'joining')`), "ok");
assert.equal(await err("u_hr", `select add_salary(${e1}, 660000, '2026-10-01', 'increment')`), "ok");
assert.match(await err("u_hr", `select add_salary(${e2}, 600000, '2026-04-01')`), /Not allowed/, "HR only own office");
assert.match(await err("u_mgr", `select add_salary(${e1}, 1, '2026-04-02')`), /Not allowed/, "managers can't");
assert.match(await err("u_e1", `select add_salary(${e1}, 1, '2026-04-02')`), /Not allowed/);
assert.equal(await err("u_admin", `select add_salary(${e2}, 900000, '2026-04-01')`), "ok");
assert.equal(await as("u_e1", "select count(*) from employee_salaries"), "2", "own salary only");
assert.equal(await as("u_e2", "select count(*) from employee_salaries"), "1");
assert.equal(await as("u_mgr", "select count(*) from employee_salaries"), "0", "managers can't read salaries");
assert.equal(await as("u_hr", "select count(*) from employee_salaries"), "2", "HR sees own office only");
assert.equal(await as("u_admin", "select count(*) from employee_salaries"), "3");
assert.equal(await as("u_e1", `update employee_salaries set annual_ctc = 1 returning id`), "ERR", "no direct writes");
assert.equal(await as("u_e1", `insert into employee_salaries(employee_id, annual_ctc, effective_from) select ${e1}, 9, '2026-01-01' returning id`), "ERR");
// bank details
assert.equal(await err("u_e1", `select save_bank_details(${e1}, 'E One', '123456789012', 'hdfc0001234', 'HDFC', 'abcde1234f', null)`), "ok");
assert.match(await err("u_e1", `select save_bank_details(${e1}, 'E One', '123456789012', 'BAD', 'HDFC')`), /ifsc/);
assert.match(await err("u_e1", `select save_bank_details(${e1}, 'E One', '123456789012', 'HDFC0001234', 'HDFC', 'xx')`), /pan/);
assert.match(await err("u_e1", `select save_bank_details(${e2}, 'X', '123456789012', 'HDFC0001234', 'HDFC')`), /Not allowed/);
assert.match(await err("u_mgr", `select save_bank_details(${e1}, 'X', '123456789012', 'HDFC0001234', 'HDFC')`), /Not allowed/);
assert.equal(await as("u_hr", "select pan from employee_bank"), "ABCDE1234F", "HR reads, uppercased");
assert.equal(await as("u_mgr", "select count(*) from employee_bank"), "0");
assert.equal(await as("u_e2", "select count(*) from employee_bank"), "0");
// sheet
const line = (emp) => `{"employee_id":"${emp}","basic":25000,"hra":10000,"special":14000,"gross":49000,"employee_pf":1800,"employer_pf":1800,"pt":200,"lop_days":1}`;
const e1id = await as("u_admin", "select id from employees where email = 'e1@x.com'"), e2id = await as("u_admin", "select id from employees where email = 'e2@x.com'");
assert.match(await err("u_mgr", `select create_payroll_run('2026-10-15', null, '[]')`), /Not allowed/);
assert.match(await err("u_hr", `select create_payroll_run('2026-10-01', null, '[]')`), /Not allowed/, "HR needs an office");
assert.match(await err("u_hr", `select create_payroll_run('2026-10-01', '00000000-0000-0000-0000-00000000000a', '[${line(e2id)}]')`), /out of scope/);
const runId = await as("u_hr", `select create_payroll_run('2026-10-15', '00000000-0000-0000-0000-00000000000a', '[${line(e1id)}]')`);
assert.match(await err("u_admin", `select create_payroll_run('2026-10-01', null, '[]')`), /already exists/);
assert.equal(await as("u_hr", `select lop_amount || '/' || net from payroll_lines`), "1580.65/45419.35", "derived in SQL");
assert.equal(await as("u_mgr", "select count(*) from payroll_runs"), "0");
assert.equal(await as("u_e1", "select count(*) from payroll_lines"), "0");
assert.equal(await err("u_hr", `select update_payroll_line((select id from payroll_lines), 0, 500, 100)`), "ok");
assert.equal(await as("u_hr", "select net from payroll_lines"), "46400.00");
assert.match(await err("u_hr", `select review_payroll_run('${runId}', true)`), /Only admin/);
assert.match(await err("u_admin", `select review_payroll_run('${runId}', true)`), /not awaiting/);
assert.equal(await err("u_hr", `select submit_payroll_run('${runId}')`), "ok");
assert.match(await err("u_hr", `select update_payroll_line((select id from payroll_lines), 0, 0, 0)`), /draft/);
assert.match(await err("u_hr", `select review_payroll_run('${runId}', true)`), /Only admin/, "HR can't approve");
assert.match(await err("u_admin", `select review_payroll_run('${runId}', false)`), /note is required/);
assert.equal(await err("u_admin", `select review_payroll_run('${runId}', false, 'fix TDS')`), "ok");
assert.equal(await as("u_hr", `select status || '/' || review_note from payroll_runs`), "draft/fix TDS");
assert.equal(await err("u_hr", `select submit_payroll_run('${runId}')`), "ok");
assert.equal(await err("u_admin", `select review_payroll_run('${runId}', true)`), "ok");
assert.match(await err("u_hr", `select delete_payroll_run('${runId}')`), /draft/, "approved = locked");
assert.equal(await as("u_hr", `delete from payroll_lines returning id`), "ERR", "no direct deletes");

// ── security: exploit attempts must fail ──
{
  await db.exec(`reset role; insert into channels(id, name, type, created_by) select '00000000-0000-0000-0000-0000000000c1', 'secret', 'group', id from employees where email = 'm@x.com';
    insert into channel_members(channel_id, employee_id) select '00000000-0000-0000-0000-0000000000c1', id from employees where email = 'm@x.com';
    insert into messages(channel_id, sender_id, body) select '00000000-0000-0000-0000-0000000000c1', id, 'private' from employees where email = 'm@x.com';`);
  const secret = "00000000-0000-0000-0000-0000000000c1";
  // move own read-marker row into someone else's channel to gain membership
  await as("u_e2", `update channel_members set channel_id = '${secret}' where channel_id = '${dm}' and employee_id = (select id from employees where email = 'e2@x.com') returning channel_id`);
  assert.equal(await as("u_e2", `select count(*) from messages where channel_id = '${secret}'`), "0", "can't hijack membership via read marker");
  // move own message into the Announcements channel / another channel
  assert.equal(await as("u_e1", `update messages set channel_id = '${annId}' where sender_id = (select id from employees where email = 'e1@x.com') returning id`), "ERR", "messages can't be moved/edited");
  // post a fake system announcement via RPC
  assert.equal(await as("u_e1", "select post_announcement('fake')"), "ERR", "post_announcement not callable");
  assert.equal(await as("u_nobody", "select post_announcement('fake')", null), "ERR");
  assert.equal(await as("u_admin", "select * from orphan_uploads(gen_random_uuid())"), "ERR", "orphan_uploads is server-only");
  // fake a department channel for another department
  assert.equal(await as("u_e2", "insert into channels(name, type, department_id, created_by) select 'Eng', 'department', (select id from departments limit 1), id from employees where email = 'e2@x.com' returning id"), "ERR", "only groups via insert");
  // add people to a DM you created
  assert.equal(await as("u_e1", `insert into channel_members(channel_id, employee_id) select '${dm}', id from employees where email = 'm@x.com' returning channel_id`), "ERR", "no extra members in DMs");
  // manager rewrites a leave request beyond the decision
  await db.exec(`reset role; insert into leave_requests(employee_id, leave_type_id, start_date, end_date, days) select e.id, t.id, '2031-03-02', '2031-03-02', 1 from employees e, leave_types t where e.email = 'e1@x.com'`);
  assert.equal(await as("u_mgr", "update leave_requests set days = 0.5 where start_date = '2031-03-02' returning days"), "ERR", "reviewers can't edit days");
  assert.equal(await as("u_mgr", "update leave_requests set status = 'approved' where start_date = '2031-03-02' returning status"), "ERR", "reviews only via review_leave()");
  const rid = "(select id from leave_requests where start_date = '2031-03-02')";
  assert.equal(await as("u_admin", `select review_leave(${rid}, true)`), "", "admin can finalize from pending");
  assert.equal(await as("u_e1", "select status from leave_requests where start_date = '2031-03-02'"), "approved");
  // manager moves an attendance row to another day / person
  await db.exec(`reset role; insert into attendance(employee_id, date, mode) select id, '2031-03-03', 'office' from employees where email = 'e1@x.com'`);
  assert.equal(await as("u_mgr", "update attendance set date = '2031-03-04' where date = '2031-03-03' returning date"), "ERR", "only times/mode/note editable");
  assert.notEqual(await as("u_mgr", "update attendance set note = 'fixed' where date = '2031-03-03' returning note"), "ERR");
  // reference someone else's uploaded file
  const e1 = await as("u_e1", "select id from employees where email = 'e1@x.com'");
  const m = await as("u_mgr", "select id from employees where email = 'm@x.com'");
  assert.match(await err("u_e1", `select apply_leave('${typeId}', '2031-04-01', '2031-04-01', false, null, '${m}/x/doc.pdf')`), /Invalid document/);
  assert.equal(await err("u_e1", `select apply_leave('${typeId}', '2031-04-02', '2031-04-02', false, null, '${e1}/x/doc.pdf')`), "ok");
  const lr = await as("u_e1", "select id from leave_requests where start_date = '2031-04-02'");
  assert.match(await err("u_e1", `select update_leave_doc('${lr}', '${m}/x/doc.pdf')`), /Invalid document/);
  assert.match(await err("u_e2", `select update_leave_doc('${lr}', (select id from employees where email = 'e2@x.com') || '/x/doc.pdf')`), /Only your own/);
  assert.equal(await err("u_e1", `select update_leave_doc('${lr}', '${e1}/y/cert.pdf')`), "ok");
  assert.equal(await as("u_e1", `insert into messages(channel_id, sender_id, attachment_path) values ('${dm}', '${e1}', '${m}/x/a.pdf') returning id`), "ERR", "attachments must be your own uploads");
  assert.notEqual(await as("u_e1", `insert into messages(channel_id, sender_id, attachment_path) values ('${dm}', '${e1}', '${e1}/x/a.pdf') returning id`), "ERR");
  // anon (no token) sees nothing
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query("select count(*) from employees"), /permission denied/, "anon has no table access");
  await db.exec("reset role");
}

// rate limiter: 3 per window, then blocked; server key only
{
  const hit = async () => (await db.query("select hit_rate_limit('t', 3, 60) as ok")).rows[0].ok;
  assert.deepEqual([await hit(), await hit(), await hit(), await hit()], [true, true, true, false]);
  assert.equal(await as("u_admin", "select hit_rate_limit('x', 3, 60)"), "ERR", "not callable through the API");
  assert.equal(await as("u_admin", "select count(*) from rate_limits"), "ERR");
  await db.exec("reset role");
  await assert.rejects(db.query("insert into messages(channel_id, body) select id, repeat('x', 5001) from channels limit 1"), /check constraint/, "message length capped");
}

console.log("rls ok");
