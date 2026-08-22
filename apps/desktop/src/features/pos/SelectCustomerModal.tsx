import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Footprints,
  Search,
  Target,
  UserRound,
  X,
} from "lucide-react";
import { useLocale } from "@/i18n";
import { useConnectivity } from "@/features/shell";
import {
  formatCustomerPhone,
  searchPosCustomers,
  type SaleCustomer,
} from "@/lib/customerSearch";
import { useAuth } from "@/features/auth";
import { apiRequest } from "@/lib/api";

export type SelectCustomerModalProps = {
  onClose: () => void;
  /** Attach customer + points snapshot to the active sale. */
  onSelect: (customer: SaleCustomer) => void;
  /** Clear customer → walk-in. */
  onWalkIn: () => void;
  showToast?: (message: string, tone?: "success" | "error" | "info") => void;
};

type LoadIssue = "offline" | "failed" | null;

/**
 * Select Customer (F8) — Batch R (+ Slice 5 lock + Batch AL POS Create).
 * Search phone/name · Enter select · Esc close · Walk-in.
 * Keyboard: arrows / Enter / Esc. No Tab.
 * Cashier/Manager success: do not attach; toast; stay on Select Customer.
 * Owner success: Active; may attach.
 * No offline customer queue.
 * No PATCH-customer UI on POS for any role in M5 (edit = Owner web).
 */
export function SelectCustomerModal({
  onClose,
  onSelect,
  onWalkIn,
  showToast,
}: SelectCustomerModalProps) {
  const { t } = useLocale();
  const { isOnline } = useConnectivity();
  const { user } = useAuth();
  const titleId = useId();
  const listId = useId();
  const searchId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const walkInRef = useRef<HTMLButtonElement>(null);

  // Search mode states
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SaleCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loadIssue, setLoadIssue] = useState<LoadIssue>(null);

  // Create mode states
  const [mode, setMode] = useState<"search" | "create">("search");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneStatus, setPhoneStatus] = useState<"idle" | "checking" | "available" | "duplicate" | "error">("idle");
  const [createLoading, setCreateLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<{ name?: string; phone?: string }>({});
  const [createFocusedIndex, setCreateFocusedIndex] = useState(0);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const registerBtnRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    queueMicrotask(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    });
  }, []);

  // Search effect
  useEffect(() => {
    if (mode !== "search") return;
    const needle = query.trim();
    if (!needle) {
      setRows([]);
      setLoading(false);
      setLoadIssue(null);
      setFocusedIndex(0);
      return;
    }

    if (!isOnline) {
      setRows([]);
      setLoading(false);
      setLoadIssue("offline");
      setFocusedIndex(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadIssue(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const list = await searchPosCustomers(needle, { online: true });
          if (cancelled) return;
          setRows(list);
          setFocusedIndex(0);
          setLoadIssue(null);
        } catch {
          if (cancelled) return;
          setRows([]);
          setLoadIssue("failed");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, isOnline, mode]);

  // Live Phone check effect
  useEffect(() => {
    const trimmed = phone.trim();
    if (!trimmed || trimmed.length < 10 || mode !== "create") {
      setPhoneStatus("idle");
      return;
    }

    setPhoneStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ phone: trimmed });
        const res = await apiRequest<{ exists: boolean; customer: any }>(`/api/v1/customers/phone-check?${q}`);
        setPhoneStatus(res.exists ? "duplicate" : "available");
      } catch {
        setPhoneStatus("error");
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [phone, mode]);

  // Focus ref sync for Create mode
  useEffect(() => {
    if (mode !== "create") return;
    if (createFocusedIndex === 0) {
      nameRef.current?.focus();
    } else if (createFocusedIndex === 1) {
      phoneRef.current?.focus();
    } else if (createFocusedIndex === 2) {
      cancelBtnRef.current?.focus();
    } else if (createFocusedIndex === 3) {
      submitRef.current?.focus();
    }
  }, [createFocusedIndex, mode]);

  const selectFocused = useCallback(() => {
    const row = rows[focusedIndex];
    if (!row) return;
    onSelect(row);
  }, [rows, focusedIndex, onSelect]);

  const moveFocus = useCallback(
    (delta: number) => {
      if (rows.length === 0) return;
      setFocusedIndex((i) => (i + delta + rows.length) % rows.length);
    },
    [rows.length],
  );

  const handleOpenCreate = () => {
    if (!isOnline) {
      showToast?.(t("customer.registerOfflineError"), "error");
      return;
    }
    setMode("create");
    setName("");
    setPhone("");
    setFormErrors({});
    setPhoneStatus("idle");
    setCreateFocusedIndex(0);
    setTimeout(() => {
      nameRef.current?.focus();
    }, 50);
  };

  const handleCancelCreate = () => {
    setMode("search");
    setName("");
    setPhone("");
    setFormErrors({});
    setPhoneStatus("idle");
    setFocusedIndex(0);
    setTimeout(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }, 50);
  };

  const handleSubmitCreate = async () => {
    if (createLoading) return;

    // Validate inputs
    const errors: { name?: string; phone?: string } = {};
    if (!name.trim()) {
      errors.name = t("customer.nameRequired");
    }
    if (!phone.trim()) {
      errors.phone = t("customer.phoneRequired");
    } else if (phone.trim().length < 10) {
      errors.phone = t("customer.phoneInvalid");
    } else if (phoneStatus === "duplicate") {
      errors.phone = t("customer.phoneDuplicate");
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (errors.name) {
        setCreateFocusedIndex(0);
      } else if (errors.phone) {
        setCreateFocusedIndex(1);
      }
      return;
    }

    setCreateLoading(true);
    try {
      const isOwner = user?.role === "OWNER" || user?.role === "SUPER_ADMIN";
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        source: "POS_REGISTRATION" as const,
      };

      const res = await apiRequest<any>("/api/v1/customers", {
        method: "POST",
        body: payload,
      });

      setCreateLoading(false);

      if (isOwner) {
        showToast?.(t("customer.activeSuccessToast"), "success");
        onSelect({
          customerId: res.id,
          name: res.name,
          phone: res.phone,
          loyaltyPoints: res.loyaltyPoints || 0,
        });
      } else {
        showToast?.(t("customer.pendingSuccessToast"), "success");
        handleCancelCreate();
      }
    } catch (err: any) {
      setCreateLoading(false);
      if (err.statusCode === 409) {
        setPhoneStatus("duplicate");
        setFormErrors({ phone: t("customer.phoneDuplicate") });
        setCreateFocusedIndex(1);
      } else {
        showToast?.(err.message || "Failed to register customer", "error");
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (mode === "create") {
        handleCancelCreate();
      } else {
        onClose();
      }
      return;
    }

    if (mode === "create") {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        if (createFocusedIndex === 0) {
          setCreateFocusedIndex(1);
        } else if (createFocusedIndex === 1) {
          setCreateFocusedIndex(3); // default to Submit button
        }
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        if (createFocusedIndex === 1) {
          setCreateFocusedIndex(0);
        } else if (createFocusedIndex === 2 || createFocusedIndex === 3) {
          setCreateFocusedIndex(1);
        }
        return;
      }
      if (event.key === "ArrowLeft") {
        if (createFocusedIndex === 3) {
          event.preventDefault();
          event.stopPropagation();
          setCreateFocusedIndex(2);
        }
        return;
      }
      if (event.key === "ArrowRight") {
        if (createFocusedIndex === 2) {
          event.preventDefault();
          event.stopPropagation();
          setCreateFocusedIndex(3);
        }
        return;
      }
      if (event.key === "Enter") {
        const active = document.activeElement;
        if (active === cancelBtnRef.current) {
          handleCancelCreate();
          return;
        }
        if (active === submitRef.current) {
          void handleSubmitCreate();
          return;
        }
        if (createFocusedIndex === 0) {
          event.preventDefault();
          event.stopPropagation();
          setCreateFocusedIndex(1);
          return;
        }
        if (createFocusedIndex === 1) {
          event.preventDefault();
          event.stopPropagation();
          void handleSubmitCreate();
          return;
        }
      }
      return;
    }

    if (mode === "search" && event.key === "F3") {
      event.preventDefault();
      event.stopPropagation();
      handleOpenCreate();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      const active = document.activeElement;

      if (active === searchRef.current) {
        if (rows.length > 0) {
          if (focusedIndex === rows.length - 1) {
            registerBtnRef.current?.focus();
          } else {
            moveFocus(1);
          }
        } else {
          registerBtnRef.current?.focus();
        }
        return;
      }

      if (active === registerBtnRef.current || active === walkInRef.current) {
        return;
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const active = document.activeElement;

      if (active === registerBtnRef.current || active === walkInRef.current) {
        searchRef.current?.focus();
        if (rows.length > 0) {
          setFocusedIndex(rows.length - 1);
        }
        return;
      }

      if (active === searchRef.current) {
        if (rows.length > 0) {
          if (focusedIndex > 0) {
            moveFocus(-1);
          }
        }
        return;
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      const active = document.activeElement;
      if (active === walkInRef.current) {
        event.preventDefault();
        event.stopPropagation();
        registerBtnRef.current?.focus();
      }
      return;
    }

    if (event.key === "ArrowRight") {
      const active = document.activeElement;
      if (active === registerBtnRef.current) {
        event.preventDefault();
        event.stopPropagation();
        walkInRef.current?.focus();
      }
      return;
    }

    if (event.key === "Enter") {
      const active = document.activeElement;
      if (active === walkInRef.current) {
        onWalkIn();
        return;
      }
      if (active === registerBtnRef.current) {
        handleOpenCreate();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (rows[focusedIndex]) {
        selectFocused();
      }
      return;
    }
  };

  const needle = query.trim();
  const emptyHint = !needle
    ? t("customer.typeToFind")
    : loading
      ? t("customer.searching")
      : loadIssue === "offline"
        ? t("customer.offlineSearch")
        : loadIssue === "failed"
          ? t("customer.searchFailed")
          : t("customer.noMatch");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDownCapture={onKeyDown}
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-base font-bold tracking-tight text-foreground"
            >
              {mode === "create" ? t("customer.registerTitle") : t("customer.selectTitle")}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {mode === "create" ? t("customer.registerSubtitle") : t("customer.searchSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={mode === "create" ? handleCancelCreate : onClose}
            className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={t("customer.close")}
          >
            <X className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </div>

        {mode === "create" ? (
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-1">
              <label htmlFor="customer-name" className="block text-xs font-semibold text-muted uppercase tracking-wider">
                {t("customer.nameLabel")} <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                ref={nameRef}
                id="customer-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formErrors.name) {
                    setFormErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                disabled={createLoading}
                autoComplete="off"
                className={[
                  "w-full rounded-md border bg-canvas px-3 py-2 text-sm text-foreground outline-none focus:ring-2",
                  formErrors.name
                    ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                    : "border-border focus:border-primary focus:ring-primary/30",
                ].join(" ")}
              />
              {formErrors.name && (
                <p className="text-xs font-medium text-red-500 mt-1">{formErrors.name}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="customer-phone" className="block text-xs font-semibold text-muted uppercase tracking-wider">
                {t("customer.phoneLabel")} <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                ref={phoneRef}
                id="customer-phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (formErrors.phone) {
                    setFormErrors((prev) => ({ ...prev, phone: undefined }));
                  }
                }}
                disabled={createLoading}
                autoComplete="off"
                className={[
                  "w-full rounded-md border bg-canvas px-3 py-2 text-sm text-foreground outline-none focus:ring-2",
                  formErrors.phone
                    ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                    : "border-border focus:border-primary focus:ring-primary/30",
                ].join(" ")}
              />
              {formErrors.phone && (
                <p className="text-xs font-medium text-red-500 mt-1">{formErrors.phone}</p>
              )}
              {phoneStatus === "checking" && (
                <p className="text-xs text-muted flex items-center gap-1.5 mt-1 animate-pulse">
                  <span className="size-1.5 rounded-full bg-muted-foreground animate-ping" />
                  {t("customer.phoneChecking")}
                </p>
              )}
              {phoneStatus === "available" && (
                <p className="text-xs text-emerald-500 font-medium flex items-center gap-1 mt-1">
                  ✓ {t("customer.phoneAvailable")}
                </p>
              )}
              {phoneStatus === "duplicate" && (
                <p className="text-xs text-amber-500 font-medium flex items-center gap-1 mt-1">
                  ⚠ {t("customer.phoneDuplicate")}
                </p>
              )}
              {phoneStatus === "error" && (
                <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-1">
                  ⚠ {t("customer.phoneError")}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 px-5 py-4">
            <label htmlFor={searchId} className="sr-only">
              {t("customer.searchAria")}
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                strokeWidth={1.75}
                aria-hidden
              />
              <input
                ref={searchRef}
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("customer.searchPlaceholder")}
                autoComplete="off"
                className="w-full rounded-md border border-border bg-canvas py-2.5 pr-3 pl-10 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div
              id={listId}
              role="listbox"
              aria-label={t("customer.resultsAria")}
              className="max-h-64 min-h-30 overflow-auto rounded-md border border-border"
            >
              {rows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  {emptyHint}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {rows.map((row, index) => {
                    const selected = index === focusedIndex;
                    const phoneLabel = formatCustomerPhone(row.phone);
                    return (
                      <li key={row.customerId} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          onMouseEnter={() => setFocusedIndex(index)}
                          onClick={() => onSelect(row)}
                          className={[
                            "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                            selected
                              ? "border-l-[3px] border-l-primary bg-primary/10"
                              : "border-l-[3px] border-l-transparent hover:bg-canvas",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "flex size-10 shrink-0 items-center justify-center rounded-md",
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "bg-shell text-muted",
                            ].join(" ")}
                          >
                            <UserRound
                              className="size-5"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground">
                              {row.name}
                            </span>
                            {phoneLabel ? (
                              <span className="mt-0.5 block truncate text-xs text-muted tabular-nums">
                                {phoneLabel}
                              </span>
                            ) : null}
                            <span
                              className={[
                                "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                                selected
                                  ? "bg-primary/15 text-primary"
                                  : "bg-shell text-muted",
                              ].join(" ")}
                            >
                              <Target
                                className="size-3"
                                strokeWidth={2}
                                aria-hidden
                              />
                              {row.loyaltyPoints} {t("customer.points")}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {mode === "create" ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3 text-sm">
            <button
              ref={cancelBtnRef}
              type="button"
              onClick={handleCancelCreate}
              disabled={createLoading}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            >
              {t("customer.registerCancel")}
            </button>
            <button
              ref={submitRef}
              type="button"
              onClick={handleSubmitCreate}
              disabled={createLoading || phoneStatus === "checking" || phoneStatus === "duplicate"}
              className={[
                "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50",
                createLoading || phoneStatus === "checking" || phoneStatus === "duplicate"
                  ? "bg-primary/50 cursor-not-allowed"
                  : "bg-primary hover:bg-primary/95",
              ].join(" ")}
            >
              {createLoading && <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />}
              {t("customer.registerSubmit")}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
            <button
              ref={registerBtnRef}
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <UserRound className="size-4" strokeWidth={1.75} aria-hidden />
              {t("customer.registerBtn")}
            </button>
            <button
              ref={walkInRef}
              type="button"
              onClick={onWalkIn}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Footprints className="size-4" strokeWidth={1.75} aria-hidden />
              {t("customer.continueWalkIn")}
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-shell px-5 py-2 text-[11px] text-muted">
          {mode === "create" ? (
            <p>
              <kbd className="font-semibold text-foreground">[Enter]</kbd>{" "}
              {createFocusedIndex === 2 ? t("customer.registerCancel") : t("customer.registerSubmit")}{" "}
              <span className="mx-1.5 text-border">·</span>
              <kbd className="font-semibold text-foreground">[Esc]</kbd>{" "}
              {t("customer.registerCancel")}{" "}
              <span className="mx-1.5 text-border">·</span>
              <kbd className="font-semibold text-foreground">[↑↓←→]</kbd>{" "}
              {t("customer.navigate")}
            </p>
          ) : (
            <p>
              <kbd className="font-semibold text-foreground">[Enter]</kbd>{" "}
              {t("customer.selectAction")}{" "}
              <span className="mx-1.5 text-border">·</span>
              <kbd className="font-semibold text-foreground">[Esc]</kbd>{" "}
              {t("customer.close")}{" "}
              <span className="mx-1.5 text-border">·</span>
              <kbd className="font-semibold text-foreground">[↑↓]</kbd>{" "}
              {t("customer.navigate")}{" "}
              <span className="mx-1.5 text-border">·</span>
              <kbd className="font-semibold text-foreground">[F3]</kbd>{" "}
              {t("customer.registerTitle")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
