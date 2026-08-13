import type { ReactElement } from "react";

/** Minimal Batch A placeholder — real chrome/primitives land in later M3 batches. */
export function ShellPlaceholder(): ReactElement {
  return (
    <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
      @r2a/ui bootstrap OK
    </p>
  );
}
