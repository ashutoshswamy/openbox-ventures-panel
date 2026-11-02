"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Page links for a server-paginated list (?page=N). Keeps every other query param (filters, month …).
// Server side: pageOf(sp.page, SIZE) → .range(from, to) with { count: "exact" } → <Pager page total size />.
export function Pager({ page, total, size }: { page: number; total: number; size: number }) {
  const path = usePathname();
  const sp = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / size));
  const href = (p: number) => {
    const q = new URLSearchParams(sp);
    if (p > 1) q.set("page", String(p)); else q.delete("page");
    return q.size ? `${path}?${q}` : path;
  };
  if (page > pages) return <p className="mt-4 text-sm text-muted">No more results. <Link href={href(1)} className="font-medium text-primary">Back to page 1</Link></p>;
  if (pages === 1) return null;

  // 1 … 4 5 [6] 7 8 … 20
  const nums = [...new Set([1, pages, ...[-2, -1, 0, 1, 2].map((d) => page + d)])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const btn = "btn h-9 min-w-9 justify-center px-2.5 tabular-nums";
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted tabular-nums">{(page - 1) * size + 1}-{Math.min(page * size, total)} of {total}</p>
      <div className="flex flex-wrap items-center gap-1">
        {page > 1 ? <Link href={href(page - 1)} className={btn} aria-label="Previous page"><ChevronLeft /></Link> : <span className={`${btn} pointer-events-none opacity-40`}><ChevronLeft /></span>}
        {nums.map((p, i) => (
          <span key={p} className="contents">
            {i > 0 && p - nums[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
            <Link href={href(p)} aria-current={p === page ? "page" : undefined} className={`${btn} ${p === page ? "btn-primary" : ""}`}>{p}</Link>
          </span>
        ))}
        {page < pages ? <Link href={href(page + 1)} className={btn} aria-label="Next page"><ChevronRight /></Link> : <span className={`${btn} pointer-events-none opacity-40`}><ChevronRight /></span>}
      </div>
    </nav>
  );
}
