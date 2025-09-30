import React from "react";

/** Normalize multiline text coming from backend that may contain:
 * 1. CRLF (\r\n) sequences -> converted to \n
 * 2. Literal escaped newlines (\\n) -> converted to real newlines
 * 3. Single-line bullet lists using " • " separators with no existing newlines -> promote bullets to new lines
 */
export function normalizeMultiline(raw: string | undefined | null): string {
  if (!raw) return "";
  let t = raw.replace(/\r\n/g, "\n").replace(/\\n/g, "\n");
  if (t.includes("•") && !/\n/.test(t)) {
    t = t.replace(/ \u2022 /g, "\n• ").replace(/ • /g, "\n• ");
    t = t.replace(/^\n/, "");
  }
  return t;
}

export const Multiline: React.FC<{ text: string; className?: string }> = ({
  text,
  className = "",
}) => {
  if (!text) return null;
  return (
    <p className={"leading-relaxed whitespace-pre-line " + className}>
      {normalizeMultiline(text)}
    </p>
  );
};

export default Multiline;
