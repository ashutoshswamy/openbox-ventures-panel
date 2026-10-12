// Demo mode: all sample data. Nothing here touches Supabase/Clerk. Read-only seed; mutable state goes through useDemo() (lib/demo/store.ts).
import { todayIn } from "@/lib/util";

export type DemoRole = "employee" | "manager" | "hr" | "admin";
export const ROLE_LABEL: Record<DemoRole, string> = { employee: "Employee", manager: "Manager", hr: "HR", admin: "Admin" };

export const today = () => todayIn();
// YYYY-MM-DD, n days from today (negative = past)
export const daysFrom = (n: number) => new Date(Date.parse(today()) + n * 864e5).toISOString().slice(0, 10);

export type Office = { id: string; name: string; address: string; work_start: string; work_end: string; grace_min: number; radius_m: number };
export const OFFICES: Office[] = [
  { id: "o1", name: "Pune HQ", address: "Baner Road, Pune 411045", work_start: "09:30", work_end: "18:30", grace_min: 15, radius_m: 200 },
  { id: "o2", name: "Bengaluru", address: "Indiranagar, Bengaluru 560038", work_start: "10:00", work_end: "19:00", grace_min: 15, radius_m: 200 },
];

export type Department = { id: string; office_id: string; name: string };
export const DEPARTMENTS: Department[] = [
  { id: "d1", office_id: "o1", name: "Engineering" },
  { id: "d2", office_id: "o1", name: "Design" },
  { id: "d3", office_id: "o1", name: "Operations" },
  { id: "d4", office_id: "o2", name: "Engineering" },
  { id: "d5", office_id: "o2", name: "Sales" },
];

export type DemoEmployee = {
  id: string; code: string; name: string; email: string; role: DemoRole; designation: string;
  office_id: string; department_id: string | null; reports_to: string | null; joined_on: string; ctc: number; phone: string;
};
// e1 = admin, e2 = HR, e3 = manager, e4 = the demo employee
export const EMPLOYEES: DemoEmployee[] = [
  { id: "e1", code: "OBV001", name: "Rohan Mehta", email: "rohan@openboxventures.in", role: "admin", designation: "Managing Partner", office_id: "o1", department_id: null, reports_to: null, joined_on: "2021-04-01", ctc: 4800000, phone: "+91 98200 00001" },
  { id: "e2", code: "OBV002", name: "Priya Nair", email: "priya@openboxventures.in", role: "hr", designation: "HR Lead", office_id: "o1", department_id: "d3", reports_to: "e1", joined_on: "2021-09-15", ctc: 1800000, phone: "+91 98200 00002" },
  { id: "e3", code: "OBV003", name: "Arjun Kapoor", email: "arjun@openboxventures.in", role: "manager", designation: "Engineering Manager", office_id: "o1", department_id: "d1", reports_to: "e1", joined_on: "2022-01-10", ctc: 2800000, phone: "+91 98200 00003" },
  { id: "e4", code: "OBV004", name: "Sneha Iyer", email: "sneha@openboxventures.in", role: "employee", designation: "Frontend Developer", office_id: "o1", department_id: "d1", reports_to: "e3", joined_on: "2023-06-05", ctc: 1500000, phone: "+91 98200 00004" },
  { id: "e5", code: "OBV005", name: "Vikram Joshi", email: "vikram@openboxventures.in", role: "employee", designation: "Backend Developer", office_id: "o1", department_id: "d1", reports_to: "e3", joined_on: "2023-02-20", ctc: 1650000, phone: "+91 98200 00005" },
  { id: "e6", code: "OBV006", name: "Ananya Rao", email: "ananya@openboxventures.in", role: "employee", designation: "Product Designer", office_id: "o1", department_id: "d2", reports_to: "e1", joined_on: "2023-08-01", ctc: 1400000, phone: "+91 98200 00006" },
  { id: "e7", code: "OBV007", name: "Karan Shah", email: "karan@openboxventures.in", role: "employee", designation: "Operations Executive", office_id: "o1", department_id: "d3", reports_to: "e2", joined_on: "2024-01-08", ctc: 900000, phone: "+91 98200 00007" },
  { id: "e8", code: "OBV008", name: "Meera Pillai", email: "meera@openboxventures.in", role: "manager", designation: "Sales Manager", office_id: "o2", department_id: "d5", reports_to: "e1", joined_on: "2022-05-16", ctc: 2400000, phone: "+91 98200 00008" },
  { id: "e9", code: "OBV009", name: "Rahul Desai", email: "rahul@openboxventures.in", role: "employee", designation: "Full-stack Developer", office_id: "o2", department_id: "d4", reports_to: "e3", joined_on: "2024-03-11", ctc: 1700000, phone: "+91 98200 00009" },
  { id: "e10", code: "OBV010", name: "Divya Menon", email: "divya@openboxventures.in", role: "employee", designation: "Sales Executive", office_id: "o2", department_id: "d5", reports_to: "e8", joined_on: "2024-07-22", ctc: 850000, phone: "+91 98200 00010" },
];

// Who "you" are for each role in the demo
export const ME_BY_ROLE: Record<DemoRole, string> = { employee: "e4", manager: "e3", hr: "e2", admin: "e1" };
export const emp = (id: string) => EMPLOYEES.find((e) => e.id === id)!;
export const office = (id: string | null) => OFFICES.find((o) => o.id === id);
export const dept = (id: string | null) => DEPARTMENTS.find((d) => d.id === id);

export type LeaveType = { id: string; name: string; entitled: number };
export const LEAVE_TYPES: LeaveType[] = [
  { id: "lt1", name: "Casual leave", entitled: 12 },
  { id: "lt2", name: "Sick leave", entitled: 8 },
  { id: "lt3", name: "Earned leave", entitled: 15 },
];

export type Holiday = { id: string; name: string; date: string; office_id: string | null };
export const HOLIDAYS: Holiday[] = [
  { id: "h1", name: "Diwali", date: daysFrom(5), office_id: null },
  { id: "h2", name: "Bhai Dooj", date: daysFrom(7), office_id: null },
  { id: "h3", name: "Kannada Rajyotsava", date: daysFrom(20), office_id: "o2" },
  { id: "h4", name: "Christmas", date: daysFrom(74), office_id: null },
];

export type Announcement = { id: string; title: string; body: string; date: string; author: string };
export const ANNOUNCEMENTS: Announcement[] = [
  { id: "a1", title: "Diwali holidays", body: "Office is closed for Diwali and Bhai Dooj. Wishing everyone a safe and bright festival!", date: daysFrom(-1), author: "e2" },
  { id: "a2", title: "Quarterly all-hands", body: "All-hands this Friday at 4 PM in the Pune HQ cafeteria. Bengaluru joins on video.", date: daysFrom(-4), author: "e1" },
  { id: "a3", title: "New expense policy", body: "Reimbursement claims must be filed within 30 days. Details are in the shared drive.", date: daysFrom(-9), author: "e2" },
];

export const SALARY_MONTHS = [-1, -2, -3].map((i) => {
  const d = new Date(Date.parse(today()));
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + i);
  return d.toISOString().slice(0, 10);
}); // first of the last 3 months
