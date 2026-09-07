"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type ExpandableMessageProps = {
  message: string;
};

/**
 * The only interactive part of a message row (§5.4 allows expansion here).
 * The row itself stays server-rendered so dates format once, on the server.
 */
export function ExpandableMessage({ message }: ExpandableMessageProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setIsOpen((open) => !open)}
      aria-expanded={isOpen}
      className="flex w-full items-start gap-2 text-left text-sm text-(--ink)"
    >
      <span className={isOpen ? "whitespace-pre-wrap" : "line-clamp-2"}>
        {message}
      </span>
      <ChevronDown
        className={`mt-0.5 size-4 shrink-0 text-(--muted-ink) transition ${isOpen ? "rotate-180" : ""}`}
        aria-hidden
      />
    </button>
  );
}
