"use client";

import { cn } from "@/lib/utils";

interface SimpleTableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared table wrapper that provides the standard AgroNova table structure:
 * overflow-x-auto, dark-themed thead, and tr-hover tbody rows.
 * Pass column headers via `headers`; render <tr> elements as `children`.
 */
export function SimpleTable({ headers, children, className }: SimpleTableProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-text-muted">
            {headers.map(h => (
              <th key={h} className="text-left py-2 px-3 font-medium first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
