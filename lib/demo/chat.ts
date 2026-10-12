"use client";
// Demo chat seed + hooks. All in memory (keys "chat:*").
import { DEPARTMENTS, EMPLOYEES, OFFICES, emp } from "./data";
import { useDemo } from "./store";

export type ChType = "dm" | "group" | "department" | "office" | "global";
export type Channel = { id: string; type: ChType; name: string | null; announcements: boolean; office_id: string | null; members: string[]; unread: number };
export type Msg = { id: string; sender_id: string | null; body: string; created_at: string };

export const ANN_ID = "ann";
const ago = (min: number) => new Date(Date.now() - min * 6e4).toISOString();
const mk = (ch: string, rows: [string, string, number][]): Msg[] => rows.map(([s, b, m], i) => ({ id: `${ch}-${i}`, sender_id: s, body: b, created_at: ago(m) })); // newest first

const CHANNELS = (): Channel[] => [
  { id: ANN_ID, type: "global", name: "Announcements", announcements: true, office_id: null, members: ["*"], unread: 0 },
  { id: "gen", type: "global", name: "General", announcements: false, office_id: null, members: ["*"], unread: 2 },
  ...OFFICES.map((o): Channel => ({ id: `off-${o.id}`, type: "office", name: o.name, announcements: false, office_id: o.id, members: EMPLOYEES.filter((e) => e.office_id === o.id).map((e) => e.id), unread: o.id === "o1" ? 1 : 0 })),
  ...DEPARTMENTS.map((d): Channel => ({ id: `dep-${d.id}`, type: "department", name: d.name, announcements: false, office_id: d.office_id, members: EMPLOYEES.filter((e) => e.department_id === d.id).map((e) => e.id), unread: 0 })),
  { id: "grp1", type: "group", name: "Project Falcon", announcements: false, office_id: null, members: ["e3", "e4", "e5", "e6"], unread: 0 },
  { id: "dm1", type: "dm", name: null, announcements: false, office_id: null, members: ["e4", "e3"], unread: 1 },
  { id: "dm2", type: "dm", name: null, announcements: false, office_id: null, members: ["e4", "e5"], unread: 0 },
  { id: "dm3", type: "dm", name: null, announcements: false, office_id: null, members: ["e1", "e3"], unread: 0 },
];

const MESSAGES = (): Record<string, Msg[]> => ({
  gen: mk("gen", [
    ["e2", "Reminder: please update your profile details before month end.", 40],
    ["e1", "Great quarter everyone. Thank you for the hard work!", 300],
    ["e7", "Anyone up for chai at 4?", 1500],
  ]),
  "off-o1": mk("off-o1", [
    ["e7", "Pantry is restocked, snacks are back.", 90],
    ["e2", "The 3rd floor AC will be serviced tomorrow morning.", 1700],
  ]),
  "off-o2": mk("off-o2", [["e8", "Team lunch on Friday, my treat.", 600]]),
  "dep-d1": mk("dep-d1", [
    ["e5", "API for the payslips module is merged.", 120],
    ["e3", "Nice. Sneha, can you wire up the UI today?", 100],
    ["e4", "On it.", 95],
  ]),
  "dep-d2": mk("dep-d2", [["e6", "New design tokens are in Figma.", 800]]),
  "dep-d3": mk("dep-d3", [["e7", "Vendor invoices are filed for this month.", 900]]),
  "dep-d4": mk("dep-d4", [["e9", "Deployed the Bengaluru build to staging.", 500]]),
  "dep-d5": mk("dep-d5", [["e10", "Closed two deals this week.", 700], ["e8", "Brilliant, well done!", 690]]),
  grp1: mk("grp1", [
    ["e6", "Updated mockups are in the shared folder.", 200],
    ["e5", "Backend is ready for the new endpoints.", 260],
    ["e3", "Let's demo on Thursday.", 330],
  ]),
  dm1: mk("dm1", [
    ["e3", "Can you share the sprint update by EOD?", 15],
    ["e4", "Sure, sending it in an hour.", 25],
    ["e3", "Thanks for fixing the check-in bug yesterday.", 1300],
  ]),
  dm2: mk("dm2", [
    ["e4", "Thanks, merged!", 400],
    ["e5", "Could you review my PR when free?", 430],
  ]),
  dm3: mk("dm3", [["e3", "Hiring plan for Q4 is ready for your review.", 240], ["e1", "Sure, will look this evening.", 220]]),
});

export const useChannels = () => useDemo<Channel[]>("chat:channels", CHANNELS);
// newest first, per channel id
export const useMessages = () => useDemo<Record<string, Msg[]>>("chat:messages", MESSAGES);

export const dmName = (c: Channel, meId: string) => c.members.filter((m) => m !== meId).map((m) => emp(m).name).join(" & ");
export const chName = (c: Channel, meId: string) => (c.type === "dm" ? dmName(c, meId) : c.name ?? "Unnamed");
export const isMember = (c: Channel, meId: string) => c.members.includes("*") || c.members.includes(meId);

// Real people only (everyone is "joined" in the demo). Non-admins can't message admins.
export const REPLIES = ["Sounds good!", "Got it, thanks.", "On it.", "Let me check and get back to you.", "Perfect, thank you!", "Haha, noted.", "Can we catch up on this in a bit?"];
