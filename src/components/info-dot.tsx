"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Small circular "i" that opens a little popup with a description on click
 * (closes on outside click / Escape). Safe to place inside cards and links —
 * it stops click propagation so it won't trigger the parent.
 */
export default function InfoDot({ text, className = "" }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label="What is this?"
        aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border-[1.5px] border-neutral-400 text-neutral-500 text-[10px] font-bold leading-none cursor-pointer transition-colors hover:border-accent-300 hover:text-accent-700"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="absolute z-[60] left-1/2 -translate-x-1/2 top-6 w-64 max-w-[75vw] bg-surface rounded-[18px] elev-lg p-4 text-[12.5px] font-normal normal-case tracking-normal text-left text-neutral-700 leading-relaxed"
        >
          {text}
        </span>
      )}
    </span>
  );
}
