import type { ReactElement } from "react";
import type { CardTheme } from "@/lib/card/types";

interface CornerProps {
  label: string | ReactElement;
  sub?: string | ReactElement;
  color: string;
  font?: CardTheme["font"];
  flipped?: boolean;
}

export function Corner({
  label,
  sub,
  color,
  font,
  flipped = false,
}: CornerProps) {
  return (
    <div
      className={`absolute flex flex-col items-center${flipped ? " rotate-180" : ""}`}
      style={{
        ...(flipped
          ? { bottom: "4%", right: "6%" }
          : { top: "4%", left: "6%" }),
        color,
        lineHeight: 1.1,
      }}
    >
      <span
        style={{
          fontSize: "13cqi",
          fontWeight: font?.rankWeight ?? 700,
          fontStyle: font?.rankItalic ? "italic" : undefined,
          ...font?.rankStyle,
        }}
      >
        {label}
      </span>
      {sub !== undefined && <span style={{ fontSize: "11cqi" }}>{sub}</span>}
    </div>
  );
}
