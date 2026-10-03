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
  insert into leave_types(name) values ('Casual');
  insert into leave_requests(employee_id, leave_type_id, start_date, end_date, days)
    select e.id, t.id, current_date, current_date, 1 from employees e, leave_types t where e.email in ('e1@x.com', 'm@x.com');`);

// role = Clerk publicMetadata.role carried in the JWT
const roles = { u_admin: "admin", u_mgr: "manager", u_e1: "employee", u_e2: "employee" };
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

const approve = (email) =>
  `update leave_requests set status = 'approved', reviewed_by = (select id from me()) where status = 'pending' and employee_id = (select id from employees where email = '${email}') returning status`;
assert.equal(await as("u_e1", approve("e1@x.com")), "");
assert.equal(await as("u_mgr", approve("m@x.com")), "", "manager must not self-approve");
assert.match(await as("u_mgr", approve("e1@x.com")), /approved/);
assert.match(await as("u_admin", approve("m@x.com")), /approved/);

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
assert.match(await as("u_mgr", approve("e1@x.com")), /approved/);
assert.match(await err("u_e1", `select close_year(${y})`), /Admins only/);
assert.equal(await err("u_admin", `select close_year(${y})`), "ok");
await db.exec("reset role");
assert.equal((await db.query(`select days from leave_carry_forward cf join employees e on e.id = cf.employee_id where e.email = 'e1@x.com'`)).rows[0].days, "1.5");

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
assert.match(await err("u_e1", "select dm_with((select id from employees where email = 'a@x.com'))"), /Admins can't be messaged/);
const grp = await as("u_e1", "insert into channels(name, type, created_by) select 'g', 'group', id from employees where email = 'e1@x.com' returning id");
assert.match(await err("u_e1", `insert into channel_members(channel_id, employee_id) select '${grp}', id from employees where email = 'a@x.com'`), /row-level security/);
assert.equal(await err("u_e1", `insert into channel_members(channel_id, employee_id) select '${grp}', id from employees where email in ('e1@x.com', 'e2@x.com')`), "ok");

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
  assert.equal(await as("u_mgr", "update leave_requests set status = 'approved', reviewed_by = (select id from employees where email = 'a@x.com') where start_date = '2031-03-02' returning status"), "ERR", "reviewed_by must be the reviewer");
  assert.equal(await as("u_mgr", "update leave_requests set status = 'approved', reviewed_by = (select id from employees where email = 'm@x.com') where start_date = '2031-03-02' returning status"), "approved");
  // manager moves an attendance row to another day / person
  await db.exec(`reset role; insert into attendance(employee_id, date, mode) select id, '2031-03-03', 'office' from employees where email = 'e1@x.com'`);
  assert.equal(await as("u_mgr", "update attendance set date = '2031-03-04' where date = '2031-03-03' returning date"), "ERR", "only times/mode/note editable");
  assert.notEqual(await as("u_mgr", "update attendance set note = 'fixed' where date = '2031-03-03' returning note"), "ERR");
  // reference someone else's uploaded file
  const e1 = await as("u_e1", "select id from employees where email = 'e1@x.com'");
  const m = await as("u_mgr", "select id from employees where email = 'm@x.com'");
  assert.match(await err("u_e1", `select apply_leave('${typeId}', '2031-04-01', '2031-04-01', false, null, '${m}/x/doc.pdf')`), /Invalid document/);
  assert.equal(await err("u_e1", `select apply_leave('${typeId}', '2031-04-02', '2031-04-02', false, null, '${e1}/x/doc.pdf')`), "ok");
  assert.equal(await as("u_e1", `insert into messages(channel_id, sender_id, attachment_path) values ('${dm}', '${e1}', '${m}/x/a.pdf') returning id`), "ERR", "attachments must be your own uploads");
  assert.notEqual(await as("u_e1", `insert into messages(channel_id, sender_id, attachment_path) values ('${dm}', '${e1}', '${e1}/x/a.pdf') returning id`), "ERR");
  // anon (no token) sees nothing
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query("select count(*) from employees"), /permission denied/, "anon has no table access");
  await db.exec("reset role");
}

console.log("rls ok");
