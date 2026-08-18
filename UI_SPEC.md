* **1. Layout Structure & Flex/Grid Hierarchy**

  * Full-height admin dashboard shell with persistent left sidebar + main workspace.
  * Root: `min-h-screen flex bg-slate-50`.
  * Desktop sidebar: fixed width around `195px`.
  * Main area: `flex-1 min-w-0 flex flex-col`.
  * Sidebar hierarchy:

    * Brand/logo block.
    * Primary navigation stack.
    * Help & Support + Owner Profile pinned at bottom with `mt-auto`.
  * Main top bar:

    * Left: current branch selector.
    * Right: search, notification, profile/avatar controls.
    * `flex items-center justify-between`.
  * Page content wrapper:

    * `flex-1 px-4 py-5`.
    * `space-y-4`.
  * Breadcrumb above page title.
  * Page header:

    * Left: title + description.
    * Right: Export, Print, Create Return Manifest actions.
    * Desktop: `flex items-start justify-between`.
    * Mobile: stacked.
  * KPI section:

    * 4 equal cards.
    * Desktop: `grid grid-cols-4 gap-3`.
    * Tablet: `sm:grid-cols-2`.
    * Mobile: `grid-cols-1`.
  * Main queue card:

    * Full-width bordered card below KPI row.
    * Hierarchy:

      * Selection summary/action bar.
      * Queue title/description.
      * Search/filter toolbar.
      * Data table.
      * Informational footer note.
  * Selection bar:

    * Full-width teal background.
    * Left: selected batch count + supplier + total quantity + cost value.
    * Right: `Create Return Manifest`.
    * `flex items-center justify-between`.
  * Queue toolbar:

    * Search input left.
    * Supplier filter + Return Status filter right.
    * `flex justify-between items-center gap-3`.
  * Table:

    * Checkbox selection column.
    * Medicine.
    * Batch.
    * Expiry.
    * Quantity.
    * Cost Value.
    * Supplier.
    * Return Status.
  * Table requires vertical continuation for additional rows.
  * Long content should remain inside one queue card rather than split into multiple cards.
  * Footer note centered beneath table.
  * Mobile:

    * Sidebar becomes drawer.
    * Header actions wrap.
    * KPI cards stack.
    * Selection bar stacks if necessary.
    * Table uses horizontal scrolling.

* **2. Key Tailwind Classes — Colors, Spacing & Responsive Breakpoints**

  * App background: `bg-[#F7F9FA]` / `bg-slate-50`.
  * Sidebar: `bg-white`.
  * Cards: `bg-white border border-slate-200 rounded-md`.
  * Primary text: `text-slate-950`.
  * Secondary text: `text-slate-500`.
  * Muted/disabled text: `text-slate-400`.
  * Brand teal: `#007F73` / `#078C80`.
  * Primary action: `bg-[#078C80] text-white`.
  * Primary hover: `hover:bg-[#067A70]`.
  * Selection bar: `bg-[#078C80] text-white`.
  * Neutral border: `border-slate-200`.
  * Stronger input/button border: `border-slate-300`.
  * Table header: `bg-slate-50`.
  * Selected table row: subtle `bg-teal-50/40`.
  * Disabled/prepared rows: `bg-slate-50 text-slate-500`.
  * Eligible badge:

    * `bg-teal-100 text-teal-800`.
  * Manifest Prepared badge:

    * `bg-indigo-50 text-indigo-400`.
  * Not Eligible badge:

    * `bg-slate-200 text-slate-500`.
  * Expired badge:

    * `bg-red-100 text-red-500`.
  * Alert/error accent: `text-red-500`.
  * KPI card icon accents:

    * Eligible Batches: teal.
    * Eligible Cost Value: teal.
    * Manifests Prepared: blue.
    * Needs Review: red.
  * Standard page spacing: `gap-3` / `gap-4`.
  * Card padding: `p-3` to `p-4`.
  * Queue header padding: `px-4 py-3`.
  * Table cells: `px-3 py-3`.
  * Toolbar: `px-3 py-3`.
  * Selection bar: `px-4 py-3`.
  * Button height: `h-8`.
  * Search/filter height: `h-8`.
  * Typography:

    * Page title: `text-xl font-semibold tracking-tight`.
    * Card title: `text-base font-semibold`.
    * KPI label: `text-[10px] font-semibold uppercase tracking-wide`.
    * KPI value: `text-xl font-semibold`.
    * Table header: `text-[10px] font-semibold uppercase tracking-wide`.
    * Table body: `text-[11px]`.
    * Supporting text: `text-[10px] text-slate-500`.
  * Sidebar nav item:

    * `h-8 px-3 flex items-center gap-3 text-xs`.
  * Active nav:

    * `bg-[#078C80] text-white rounded-sm`.
  * Inactive nav:

    * `text-slate-800 hover:bg-slate-100`.
  * Responsive:

    * Sidebar: `hidden md:flex md:w-[195px]`.
    * Mobile menu trigger: `md:hidden`.
    * Page header: `flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`.
    * KPI cards: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`.
    * Toolbar: `flex-col sm:flex-row`.
    * Selection summary: `flex-col md:flex-row`.
    * Table wrapper: `overflow-x-auto`.
    * Table: `min-w-[900px]`.
  * Buttons:

    * `transition-colors duration-150`.
    * `focus-visible:ring-2 focus-visible:ring-teal-600`.
    * Disabled: `opacity-50 cursor-not-allowed`.

* **3. Required UI Elements & Interactive States**

  * Sidebar brand:

    * Teal circular/square `P` mark.
    * `PharmaSync`.
    * Small `OWNER PORTAL`.
  * Navigation:

    * Dashboard.
    * Sales.
    * Inventory.
    * Purchasing.
    * Suppliers.
    * Customers.
    * Staff.
    * Reports.
    * Audit & FEFO.
    * Settings.
  * Suppliers remains active.
  * Bottom sidebar:

    * Help & Support.
    * Owner Profile.
  * Top branch selector:

    * `Dhanmondi Branch`.
    * Dropdown chevron.
    * Hover/focus state.
  * Top utility controls:

    * Search icon.
    * Notification bell.
    * Unread notification dot.
    * User avatar.
  * Breadcrumb:

    * `Suppliers`.
    * `Expiry Returns`.
  * Page title:

    * `Expiry Returns`.
  * Subtitle:

    * Manage supplier-return eligible batches and prepared return manifests.
  * Header action — Export:

    * Download/export icon.
    * Neutral bordered button.
    * Exports current return queue/report.
  * Header action — Print:

    * Printer icon.
    * Neutral bordered button.
    * Opens print-friendly view/browser print flow.
  * Header action — Create Return Manifest:

    * Document/list icon.
    * Teal filled button.
    * Disabled when no eligible batches are selected.
    * Enabled when valid batches are selected.
  * KPI Card — Eligible Batches:

    * Value: `4`.
    * Supporting text: currently available for supplier return.
  * KPI Card — Eligible Cost Value:

    * Value: `৳1,607`.
    * Supporting text: potential recoverable stock cost.
  * KPI Card — Manifests Prepared:

    * Value: `2`.
    * Supporting text: batches already assigned to manifests.
  * KPI Card — Needs Review:

    * Value: `2`.
    * Supporting text: currently not eligible.
  * Selection summary bar:

    * Visible only when one or more eligible rows are selected.
    * Check-circle icon.
    * `2 batches selected`.
    * Divider.
    * Supplier name: `Square Distribution Ltd.`.
    * Divider.
    * Total quantity: `110 pcs`.
    * Divider.
    * Total value: `৳335 cost value`.
    * Right-side `Create Return Manifest` button.
  * Selection summary should update dynamically based on current selected rows.
  * If selected rows span multiple suppliers:

    * Either disable manifest creation.
    * Or clearly indicate supplier grouping requirement.
  * Expiry Return Queue heading.
  * Queue description:

    * Review eligible batches and prepare supplier return manifests.
  * Search field:

    * Search icon.
    * Placeholder: `Search medicine, batch or supplier...`.
    * Filters rows by medicine name, batch number, or supplier.
    * Focus: teal ring/border.
  * Supplier filter:

    * Default: `Supplier: All`.
    * Dropdown.
    * Options derived from suppliers in queue.
  * Return Status filter:

    * Default: `Return Status: All`.
    * Dropdown.
    * Options:

      * Eligible.
      * Manifest Prepared.
      * Not Eligible.
  * Table select-all checkbox:

    * Selects only currently eligible/selectable rows.
    * Checked when all selectable visible rows are selected.
    * Indeterminate when partially selected.
  * Row checkbox states:

    * Eligible row: interactive checkbox.
    * Manifest Prepared: disabled checkbox.
    * Not Eligible: disabled checkbox.
  * Table row — eligible selected:

    * Checkbox checked.
    * Subtle teal-tinted row background.
  * Table row — eligible unselected:

    * White background.
    * Checkbox enabled.
  * Table row — unavailable:

    * Muted gray text/background.
    * Disabled checkbox.
  * Table data examples:

    * Seclo 20mg:

      * Batch `SC-2410-B`.
      * Expiry `04 Sep 2026`.
      * Quantity `36 pcs`.
      * Cost `৳180`.
      * Supplier `Square Distribution Ltd.`.
      * Status `Eligible`.
    * Amodis 400mg:

      * Batch `AM-2409-C`.
      * Expiry `09 Sep 2026`.
      * Quantity `74 pcs`.
      * Cost `৳155`.
      * Supplier `Square Distribution Ltd.`.
      * Status `Eligible`.
    * Histacin 4mg:

      * Batch `HS-2408-A`.
      * Expiry `01 Sep 2026`.
      * Quantity `240 pcs`.
      * Cost `৳312`.
      * Supplier `Popular Medicine House`.
      * Status `Manifest Prepared`.
    * Fexo 120mg:

      * Batch `FX-2411-D`.
      * Expiry `18 Oct 2026`.
      * Quantity `120 pcs`.
      * Cost `৳984`.
      * Supplier `Square Distribution Ltd.`.
      * Status `Eligible`.
    * Napa 500mg:

      * Batch `NP24031`.
      * Expiry `12 Nov 2026`.
      * Quantity `320 pcs`.
      * Cost `৳288`.
      * Supplier `Beximco Distribution`.
      * Status `Eligible`.
    * Xelva 50mg:

      * Batch `XV-2405-B`.
      * Expiry `26 Oct 2026`.
      * Quantity `45 pcs`.
      * Cost `৳1,350`.
      * Supplier `ACME Distribution`.
      * Status `Not Eligible`.
    * Napa 500mg:

      * Batch `NP23110`.
      * Expiry `20 Jun 2026`.
      * Small inline `Expired` badge.
      * Quantity `160 pcs`.
      * Cost `৳141`.
      * Supplier `Beximco Distribution`.
      * Status `Manifest Prepared`.
    * Neoceptrin R150:

      * Batch `NR-2312-A`.
      * Expiry `02 Jul 2026`.
      * Inline `Expired` badge.
      * Quantity `88 pcs`.
      * Cost `৳396`.
      * Supplier `Beximco Distribution`.
      * Status `Not Eligible`.
  * Expired date state:

    * Keep date visible.
    * Add compact red `Expired` badge beside date.
  * Eligible badge:

    * Small rounded teal badge.
  * Manifest Prepared badge:

    * Muted lavender/blue badge.
  * Not Eligible badge:

    * Gray badge.
  * Table row hover:

    * Eligible: `hover:bg-slate-50`.
    * Disabled/prepared rows should remain visually muted.
  * Create Return Manifest interaction:

    * Requires valid selected batches.
    * Opens confirmation/modal or manifest creation workflow.
    * Displays selected supplier, batch count, total quantity, and total cost.
    * Loading state during creation.
    * Prevent duplicate submission.
  * After manifest creation:

    * Selected rows transition to `Manifest Prepared`.
    * Checkboxes become disabled.
    * KPI values update.
    * Selection bar clears.
  * Export interaction:

    * Respect active filters.
    * Export current queue or filtered dataset.
  * Print interaction:

    * Use clean printable table view.
    * Hide sidebar/navigation in print layout.
  * Footer informational note:

    * Info icon.
    * Centered small muted text:

      * Return manifests are prepared in PharmaSync and can currently be exported or printed for supplier processing.
  * Loading states:

    * KPI skeletons.
    * Queue toolbar skeleton.
    * Table row skeletons.
  * Empty queue state:

    * `No expiry return batches found.`
    * Preserve filter/search controls.
  * Empty filtered state:

    * `No batches match the selected filters.`
    * Clear filters action.
  * Error state:

    * Inline queue alert.
    * Retry action.
  * Accessibility:

    * Proper semantic table headers.
    * Checkbox labels tied to medicine/batch.
    * Select-all exposes indeterminate state.
    * Disabled rows communicate reason beyond color.
    * Icon-only controls use `aria-label`.
    * Status badges contain readable text.
    * Maintain visible keyboard focus.
    * Use sufficient contrast for muted and disabled states.
