## 1. Layout Structure & Flex/Grid Hierarchy

* Root admin shell:

  * `min-h-screen flex bg-[#f6f8fa]`.
  * Left navigation sidebar + flexible main content.
* Sidebar:

  * Fixed desktop width around `w-[180px] lg:w-[200px]`.
  * `flex flex-col justify-between`.
  * `min-h-screen`.
  * Top:

    * Brand/logo.
    * Main navigation.
  * Bottom:

    * Help.
    * Owner Profile.
* Main application area:

  * `flex-1 min-w-0 flex flex-col`.
* Top header:

  * `h-14 flex items-center justify-between`.
  * Left: branch selector.
  * Right: search, notification, app/grid icon, profile.
* Main customer-details content:

  * `flex-1 p-4 md:p-5`.
  * Desktop content constrained to readable width.
* Breadcrumb row:

  * Horizontal inline navigation.
  * `Customers > Sadia Akter`.
* Customer header:

  * `flex flex-col md:flex-row md:items-start md:justify-between gap-3`.
  * Left:

    * Customer name.
    * Active status badge.
    * Supporting description.
  * Right:

    * Edit Customer.
    * More Actions dropdown.
* KPI summary row:

  * `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3`.
  * Cards:

    * Loyalty Points.
    * Total Purchases.
    * Visits.
    * Last Purchase.
* Main details region:

  * `grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-3`.
  * Left column:

    * Customer Information.
    * Registration Information.
    * Bottom two-card row.
  * Right column:

    * Timeline Activity.
* Left column:

  * `flex flex-col gap-3`.
* Customer Information card:

  * Card header.
  * Information body using `grid grid-cols-1 md:grid-cols-2`.
  * Address and Branch may span full/partial row depending width.
* Registration Information card:

  * Information notice.
  * Two-column metadata grid.
  * Divider.
  * Original Registration Values subsection.
  * Two small nested value cards.
* Bottom activity region:

  * `grid grid-cols-1 md:grid-cols-2 gap-3`.
  * Purchase History.
  * Loyalty Activity.
* Timeline card:

  * Vertical activity list.
  * Timeline marker/icon column + content column.
* Responsive behavior:

  * `< xl`: timeline moves below primary content.
  * `< md`: customer header actions stack.
  * `< sm`: KPI cards become single-column.
  * Keep all content cards full-width on mobile.
  * Sidebar becomes drawer/collapsible navigation on smaller screens.

## 2. Key Tailwind Classes — Colors, Spacing & Breakpoints

* Global:

  * `bg-[#f6f8fa]`
  * `text-slate-900`
  * `font-sans`
  * `text-xs md:text-sm`
* Sidebar:

  * `bg-[#eef1f3]`
  * `border-r border-slate-200`
  * `px-3 py-4`
* Brand:

  * `text-[#006b63]`
  * Logo tile: `bg-[#4fa99e] text-white`
  * `font-semibold`
* Sidebar navigation:

  * `flex items-center gap-3`
  * `px-3 py-2.5`
  * `text-slate-600`
  * `hover:bg-slate-100`
* Active Customers nav:

  * `bg-[#d7e7e7]`
  * `text-[#006b63]`
  * `font-semibold`
  * Optional active left indicator:

    * `border-l-2 border-[#00766c]`
* Top header:

  * `bg-white/70`
  * `border-b border-slate-200`
  * `px-4 md:px-5`
* Main content:

  * `p-4 lg:p-5`
  * `space-y-4`
* Breadcrumb:

  * `text-[10px] md:text-xs`
  * `text-slate-500`
  * Current item: `text-slate-800`
* Customer name:

  * `text-2xl font-semibold tracking-tight`
* Description:

  * `text-xs text-slate-500 mt-1`
* Standard card:

  * `bg-white`
  * `border border-slate-200`
  * `rounded-md`
  * `shadow-none`
  * `overflow-hidden`
* Card header:

  * `px-4 py-3`
  * `border-b border-slate-100`
  * `text-[10px] uppercase tracking-wide`
  * `font-semibold`
* Card body:

  * `p-4`
* KPI cards:

  * `px-4 py-3`
  * `min-h-[64px]`
  * `flex flex-col justify-between`
* KPI label:

  * `flex items-center gap-2`
  * `text-[10px] uppercase tracking-wide`
  * `font-semibold`
  * `text-slate-700`
* KPI value:

  * `text-lg md:text-xl font-medium`
  * `text-slate-950`
* Field labels:

  * `text-[9px] md:text-[10px]`
  * `text-slate-500`
  * `mb-1`
* Field values:

  * `text-xs`
  * `font-medium`
  * `text-slate-900`
* Empty field:

  * `text-slate-500`
* Active badge:

  * `inline-flex items-center`
  * `bg-teal-100`
  * `text-teal-700`
  * `px-1.5 py-0.5`
  * `rounded-sm`
  * `text-[9px] font-medium`
* Secondary button:

  * `h-8`
  * `px-3`
  * `border border-slate-200`
  * `bg-white`
  * `text-xs font-medium`
  * `hover:bg-slate-50`
  * `rounded-sm`
* More Actions button:

  * Same secondary style.
  * Chevron icon aligned right.
* Information notice:

  * `flex items-start gap-3`
  * `bg-slate-50`
  * `border border-slate-100`
  * `px-3 py-3`
  * `rounded-sm`
  * Info icon: `text-[#00766c]`
* Registration metadata:

  * `grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4`
* Divider:

  * `border-t border-slate-100 my-4`
* Original value boxes:

  * `bg-white`
  * `border border-slate-100`
  * `px-3 py-2.5`
  * `rounded-sm`
* Timeline:

  * `space-y-4`
* Timeline item:

  * `relative flex gap-3`
* Timeline marker:

  * `w-6 h-6 rounded-full`
  * `flex items-center justify-center`
  * First/approved: `bg-teal-50 text-[#00766c]`
  * Secondary: `bg-slate-100 text-slate-500`
* Timeline title:

  * `text-xs font-medium text-slate-900`
* Timeline metadata:

  * `text-[9px] text-slate-500`
* Empty state card:

  * `min-h-[130px]`
  * `flex flex-col items-center justify-center`
  * `text-center`
  * `px-5 py-6`
* Empty state icon:

  * `w-8 h-8`
  * `text-slate-300`
* Empty message:

  * `text-[10px] text-slate-600`
  * `max-w-[180px]`
* Loyalty card header balance:

  * `flex items-center justify-between`
  * Balance text: `text-[10px] text-[#00766c] font-semibold`
* Breakpoints:

  * `sm:` two KPI columns.
  * `md:` two-column information grids.
  * `lg:` increased horizontal spacing.
  * `xl:` four KPI columns + details/timeline split.
  * `2xl:` optional `max-w-[1450px]`.

## 3. Required UI Elements & Interactive States

* Persistent sidebar:

  * PharmaSync Admin Portal branding.
  * Dashboard.
  * Sales.
  * Inventory.
  * Purchasing.
  * Suppliers.
  * Customers — active.
  * Staff.
  * Reports.
  * Audit & FEFO.
  * Settings.
  * Help.
  * Owner Profile.
* Sidebar states:

  * Default.
  * Hover.
  * Active Customers state.
  * Keyboard focus.
  * Collapsed/mobile drawer state.
* Top header:

  * Dhanmondi Branch dropdown.
  * Search icon/action.
  * Notification bell.
  * App/grid menu.
  * User/profile button.
* Breadcrumb:

  * Customers link.
  * Chevron/separator.
  * Current customer name.
  * Customers link returns to directory.
* Customer header:

  * Name: "Sadia Akter".
  * Active badge inline beside name.
  * Description:

    * Customer profile, purchase activity and loyalty information.
* Header actions:

  * Edit Customer.
  * More Actions dropdown.
* Edit Customer states:

  * Default.
  * Hover.
  * Focus-visible.
  * Opens edit form/modal/page.
* More Actions:

  * Default.
  * Hover.
  * Open menu.
  * Menu item hover.
  * Keyboard navigation.
  * Potential actions:

    * Adjust loyalty points.
    * Deactivate customer.
    * View registration details.
    * Delete/archive if permissions allow.
* KPI cards:

  * Loyalty Points: `0`.
  * Total Purchases: `৳0`.
  * Visits: `0`.
  * Last Purchase: `—`.
  * Small contextual icon in each card.
* Customer Information:

  * Name.
  * Phone.
  * Email.
  * Date of Birth.
  * Gender.
  * Status.
  * Address.
  * Branch.
* Missing customer data:

  * Use em dash rather than blank fields.
* Phone:

  * Display Bangladesh formatted number.
  * Optionally clickable via `tel:`.
* Status:

  * Active badge.
  * Ensure text label exists; do not rely on color only.
* Registration Information:

  * Information notice:

    * Customer created from POS registration and approved by Owner.
  * Source:

    * POS Registration.
  * Registration Branch:

    * Dhanmondi Branch.
  * Submitted date/time.
  * Submitted By.
  * Approved date.
  * Approved By.
* Original Registration Values:

  * Original registration name.
  * Original registration phone.
  * Display inside separate bordered mini-cards.
* Purchase History card:

  * Section header.
  * Empty-state icon.
  * Empty message explaining purchase history appears after first transaction.
* Purchase History populated state:

  * Replace empty state with compact transaction list/table.
  * Support date, receipt/order, amount and branch.
  * Row hover for clickable purchases.
* Loyalty Activity card:

  * Header with Current Balance.
  * Empty-state icon.
  * Empty message.
* Loyalty populated state:

  * Activity list with:

    * Earned.
    * Redeemed.
    * Manual adjustment.
    * Date/time.
    * Point delta.
    * Running balance.
* Timeline Activity:

  * Vertically stacked chronological events.
  * Customer approved.
  * POS registration submitted.
  * Date beneath each event.
  * Actor/submitter displayed where applicable.
* Timeline visual:

  * Circular event markers.
  * Optional vertical connector line.
  * Current/positive event teal.
  * Historical/default event neutral gray.
* Loading states:

  * Skeleton customer heading.
  * Skeleton KPI values.
  * Skeleton information rows.
  * Skeleton timeline entries.
* Error state:

  * Inline alert at top of details content.
  * Retry control.
* Permission states:

  * Hide or disable Edit Customer if user lacks permission.
  * Hide restricted More Actions items based on role.
* Responsive states:

  * Mobile action buttons full-width or grouped beneath title.
  * Timeline moves below main cards.
  * Information grids collapse to single column.
  * Bottom activity cards stack vertically.
* Accessibility:

  * `focus-visible:ring-2 focus-visible:ring-[#00766c]`.
  * Icon-only controls require `aria-label`.
  * Dropdowns expose expanded state.
  * Breadcrumb uses semantic navigation.
  * Buttons maintain minimum usable hit area.
  * Status and activity states include text labels.
