import { Users } from "lucide-react";
import { Avatar } from "@/components/avatar";

// Header popover: who is in this chat. No JS needed (native <details>).
export function MemberList({ names, me }: { names: string[]; me: string }) {
  return (
    <details className="relative">
      <summary className="btn btn-icon cursor-pointer list-none" title={`${names.length} members`} aria-label={`View ${names.length} members`}><Users /></summary>
      <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-line bg-surface p-2 shadow-lg">
        <p className="px-2 py-1 text-xs font-medium text-muted">{names.length} {names.length === 1 ? "member" : "members"}</p>
        <ul className="max-h-72 overflow-y-auto">
          {names.map((n) => (
            <li key={n} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm">
              <Avatar name={n} size="size-7 text-[11px]" />
              <span className="truncate">{n}</span>
              {n === me && <span className="text-xs text-muted">(you)</span>}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
