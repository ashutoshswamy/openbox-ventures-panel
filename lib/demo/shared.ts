"use client";
// Shared mutable demo state (same key = same data on every page, so e.g. a leave applied as an employee shows up for the approver).
// Use the hooks; never import the seeds directly.
import { ANNOUNCEMENTS, daysFrom, type Announcement } from "./data";
import { useDemo } from "./store";

export type LeaveStatus = "pending" | "manager_approved" | "approved" | "rejected" | "cancelled";
export type LeaveReq = { id: string; employee_id: string; type_id: string; from: string; to: string; days: number; reason: string; status: LeaveStatus; applied_on: string };
// Flow: employee applies → manager (first step) → HR (final). Manager/branch-head leave goes straight to HR.
export const useLeave = () =>
  useDemo<LeaveReq[]>("leave", () => [
    { id: "l1", employee_id: "e4", type_id: "lt1", from: daysFrom(9), to: daysFrom(10), days: 2, reason: "Family function", status: "pending", applied_on: daysFrom(-1) },
    { id: "l2", employee_id: "e4", type_id: "lt2", from: daysFrom(-20), to: daysFrom(-20), days: 1, reason: "Fever", status: "approved", applied_on: daysFrom(-21) },
    { id: "l3", employee_id: "e5", type_id: "lt1", from: daysFrom(14), to: daysFrom(16), days: 3, reason: "Trip home", status: "pending", applied_on: daysFrom(-2) },
    { id: "l4", employee_id: "e6", type_id: "lt3", from: daysFrom(25), to: daysFrom(29), days: 5, reason: "Vacation", status: "manager_approved", applied_on: daysFrom(-5) },
    { id: "l5", employee_id: "e7", type_id: "lt2", from: daysFrom(-6), to: daysFrom(-5), days: 2, reason: "Dental surgery", status: "approved", applied_on: daysFrom(-8) },
    { id: "l6", employee_id: "e9", type_id: "lt1", from: daysFrom(3), to: daysFrom(3), days: 1, reason: "Personal work", status: "pending", applied_on: daysFrom(-1) },
  ]);

export type Regularization = { id: string; employee_id: string; date: string; reason: string; check_in: string; check_out: string; status: "pending" | "approved" | "rejected" };
export const useRegularizations = () =>
  useDemo<Regularization[]>("regularizations", () => [
    { id: "r1", employee_id: "e4", date: daysFrom(-3), reason: "Forgot to check out", check_in: "09:35", check_out: "18:40", status: "pending" },
    { id: "r2", employee_id: "e5", date: daysFrom(-2), reason: "Client visit, no check-in", check_in: "10:00", check_out: "19:00", status: "pending" },
  ]);

// Today's check-in per employee id. Absent = not checked in. ISO timestamps.
export type Attendance = { employee_id: string; date: string; in_at: string; out_at: string | null; mode: "office" | "wfh" };
export const useCheckins = () => useDemo<Attendance[]>("checkins", () => []);

export const useAnnouncements = () => useDemo<Announcement[]>("announcements", () => [...ANNOUNCEMENTS]);

export type Todo = { id: string; owner_id: string; title: string; due_on: string | null; done: boolean; assigned_by: string | null };
export const useTodos = () =>
  useDemo<Todo[]>("todos", () => [
    { id: "t1", owner_id: "e4", title: "Submit timesheet", due_on: daysFrom(0), done: false, assigned_by: null },
    { id: "t2", owner_id: "e4", title: "Review pull request #128", due_on: daysFrom(1), done: false, assigned_by: "e3" },
    { id: "t3", owner_id: "e4", title: "Update profile photo", due_on: null, done: true, assigned_by: null },
    { id: "t4", owner_id: "e3", title: "Sprint planning notes", due_on: daysFrom(2), done: false, assigned_by: null },
    { id: "t5", owner_id: "e2", title: "Publish Diwali notice", due_on: daysFrom(-1), done: false, assigned_by: null },
  ]);

export type Issue = { id: string; employee_id: string; title: string; body: string; status: "open" | "resolved"; created: string };
export const useIssues = () =>
  useDemo<Issue[]>("issues", () => [
    { id: "i1", employee_id: "e4", title: "Check-in button not responding", body: "On mobile Safari the check-in button spins forever.", status: "open", created: daysFrom(-2) },
    { id: "i2", employee_id: "e7", title: "Payslip PDF cut off", body: "Last line of the payslip is missing when printed.", status: "resolved", created: daysFrom(-12) },
  ]);

export type PayrollRun = { id: string; month: string; office_id: string; status: "draft" | "submitted" | "approved" };
export const usePayroll = () =>
  useDemo<PayrollRun[]>("payroll", () => [
    { id: "p1", month: daysFrom(-62).slice(0, 8) + "01", office_id: "o1", status: "approved" },
    { id: "p2", month: daysFrom(-31).slice(0, 8) + "01", office_id: "o1", status: "approved" },
    { id: "p3", month: daysFrom(0).slice(0, 8) + "01", office_id: "o1", status: "draft" },
  ]);

export type Audit = { id: string; at: string; actor: string; action: string; target: string };
export const useAudit = () =>
  useDemo<Audit[]>("audit", () => [
    { id: "u1", at: new Date(Date.now() - 36e5).toISOString(), actor: "e2", action: "Approved leave", target: "Ananya Rao" },
    { id: "u2", at: new Date(Date.now() - 5 * 36e5).toISOString(), actor: "e1", action: "Approved payroll", target: "Pune HQ, last month" },
    { id: "u3", at: new Date(Date.now() - 30 * 36e5).toISOString(), actor: "e1", action: "Added employee", target: "Divya Menon" },
  ]);
