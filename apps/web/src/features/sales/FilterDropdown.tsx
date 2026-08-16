import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type FilterOption<T extends string> = {
  value: T;
  label: string;
};

/**
 * Compact filter dropdown (Sales Overview). Selected row uses teal, not mock blue.
 */
export function FilterDropdown<T extends string>({
  fieldLabel,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  fieldLabel: string;
  value: T;
  options: ReadonlyArray<FilterOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];
  const triggerText = selected
    ? `${fieldLabel}: ${selected.label}`
    : fieldLabel;

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex min-w-[9.5rem] items-center justify-between gap-2 rounded-md border bg-surface px-3 py-1.5 text-sm text-foreground ${
          open ? "border-primary" : "border-border"
        }`}
      >
        <span className="truncate">{triggerText}</span>
        <ChevronDown className="size-3.5 shrink-0 text-foreground" strokeWidth={2} />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 z-30 mt-1 min-w-full overflow-hidden rounded-md border border-border bg-surface py-1 shadow-sm"
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`block w-full px-3 py-1.5 text-left text-sm ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-canvas"
                  }`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {active ? `${fieldLabel}: ${opt.label}` : opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
