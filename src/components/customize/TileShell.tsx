"use client";

import Link from "next/link";

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="w-3 h-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="w-2.5 h-2.5"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 6l3 3 5-5"
        stroke="#15110a"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  selected: boolean;
  onClick: () => void;
  previewHref: string;
  children: React.ReactNode;
};

export function TileShell({ selected, onClick, previewHref, children }: Props) {
  return (
    <div
      className="relative rounded-xl border transition-all overflow-hidden"
      style={{
        background: selected
          ? "rgba(232,196,104,0.08)"
          : "rgba(255,255,255,0.04)",
        borderColor: selected
          ? "rgba(232,196,104,0.60)"
          : "rgba(255,255,255,0.08)",
        boxShadow: selected ? "0 0 0 1px rgba(232,196,104,0.30)" : undefined,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full flex flex-col items-center gap-2 p-3 pb-6 cursor-pointer"
      >
        {children}
        {selected && (
          <div
            className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: "#e8c468" }}
          >
            <CheckIcon />
          </div>
        )}
      </button>
      <Link
        href={previewHref}
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 py-1 text-[10px] font-semibold transition-colors"
        style={{ background: "rgba(0,0,0,0.35)", color: "#7c8699" }}
      >
        <EyeIcon />
      </Link>
    </div>
  );
}
