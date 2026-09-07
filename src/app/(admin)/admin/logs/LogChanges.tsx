"use client";

import { useState } from "react";
import { Braces, ChevronDown } from "lucide-react";

import { ADMIN_EMPTY_VALUE } from "@/lib/admin/constants";

import type { AuditChange } from "../../admin-audit-labels";

/** Most entries move one field. Beyond two the cell needs a lid. */
const INLINE_CHANGE_LIMIT = 2;

const TOGGLE_CLASS =
  "inline-flex items-center gap-1 text-[0.68rem] font-semibold transition-colors";

type LogChangesProps = {
  changes: AuditChange[];
  /** Pre-serialized on the server so this leaf carries no formatting logic. */
  rawJson: string;
};

export function LogChanges({ changes, rawJson }: LogChangesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRawOpen, setIsRawOpen] = useState(false);

  if (changes.length === 0) {
    return <span className="text-(--muted-ink)">{ADMIN_EMPTY_VALUE}</span>;
  }

  const visible = isExpanded ? changes : changes.slice(0, INLINE_CHANGE_LIMIT);
  const hiddenCount = changes.length - INLINE_CHANGE_LIMIT;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <ul className="flex flex-col gap-1">
        {visible.map((change) => (
          <li key={change.key} className="text-xs leading-snug text-(--muted-ink)">
            {/* The colon is load-bearing: without it "Status Active" reads as
                one phrase instead of a field and its old value. */}
            {change.label}: {change.from}
            <span className="px-1 text-accent" aria-hidden>
              →
            </span>
            <span className="sr-only">changed to</span>
            <span className="font-semibold text-(--ink)">{change.to}</span>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setIsExpanded((open) => !open)}
          aria-expanded={isExpanded}
          className={`${TOGGLE_CLASS} text-(--accent-deep) hover:text-(--ink)`}
        >
          {isExpanded ? "Show less" : `${hiddenCount} more`}
          <ChevronDown
            className={`size-3.5 transition ${isExpanded ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      )}

      {/* Deliberately muted, not gold: the readable list above is the answer,
          and this is the escape hatch for debugging a bad write. */}
      <button
        type="button"
        onClick={() => setIsRawOpen((open) => !open)}
        aria-expanded={isRawOpen}
        className={`${TOGGLE_CLASS} text-(--muted-ink) hover:text-(--accent-deep)`}
      >
        <Braces className="size-3.5" aria-hidden />
        {isRawOpen ? "Hide raw JSON" : "Raw JSON"}
      </button>

      {/* Fixed width, not max-width: the cell is content-sized, so a wider
          block would push the whole table into horizontal scroll. */}
      {isRawOpen && (
        <pre className="w-52 overflow-x-auto rounded-lg bg-[#f5efe4] p-2 text-[0.65rem] text-(--ink)">
          {rawJson}
        </pre>
      )}
    </div>
  );
}
