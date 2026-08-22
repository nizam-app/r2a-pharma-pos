## Deactivate Staff Confirmation Modal — UI Specification

### Layout Structure

* Full-screen modal overlay:

  * `fixed inset-0`
  * Semi-transparent dark backdrop.
  * Background content blurred/dimmed.
* Modal container:

  * Center aligned.
  * Width:

    * Desktop: `max-w-md`
    * Mobile: `w-[calc(100%-32px)]`
  * Structure:

    * Header
    * Description
    * Staff information card
    * Deactivation impact section
    * Reason textarea
    * Confirmation checkbox
    * Footer actions

---

### Modal Hierarchy

* Root:

  * `fixed inset-0 flex items-center justify-center`
* Overlay:

  * `bg-black/40 backdrop-blur-sm`
* Modal:

  * `bg-white rounded-lg shadow-xl overflow-hidden`

---

### Header Section

* Layout:

  * `flex justify-between items-center`
* Left:

  * Warning icon.
  * Title:

    * "Deactivate Staff"
* Right:

  * Close icon button.
* Classes:

  * `px-5 py-4 border-b`
  * Title:

    * `text-sm font-semibold text-gray-900`
  * Warning icon:

    * `text-red-600`

---

### Description Area

* Text:

  * "Deactivate this staff account and prevent the staff member from accessing PharmaSync."
* Classes:

  * `px-5 pt-4 text-xs text-gray-500`

---

### Staff Information Card

* Container:

  * `mx-5 mt-4 p-3 border rounded-md bg-gray-50`
* Grid:

  * Two-column layout.
  * `grid grid-cols-2 gap-y-4`
* Fields:

  * Staff
  * Role
  * Branch
  * Username
* Label:

  * `text-[10px] uppercase font-semibold text-gray-500`
* Value:

  * `text-xs text-gray-800`

---

### Status Transition Section

* Horizontal divider.
* Layout:

  * Current status → New status
* Classes:

  * `flex items-center gap-2`
* Status badges:

  * Active:

    * `bg-teal-100 text-teal-700`
  * Inactive:

    * `bg-red-100 text-red-700`
* Arrow:

  * `text-gray-400`

---

### "What Happens After Deactivation" Box

* Info panel:

  * `mx-5 mt-4 p-3 bg-gray-50 border rounded-md`
* Header:

  * Small uppercase label.
* Bullet list:

  * Access blocked immediately.
  * Operational records unchanged.
  * Audit history preserved.
  * Reactivation possible later.
* Bullet icons:

  * Small status icons.
* Text:

  * `text-xs text-gray-600`

---

### Reason Input

* Label:

  * "REASON / NOTE (OPTIONAL)"
* Textarea:

  * Placeholder:

    * "Enter reason for deactivation..."
* Classes:

  * `mx-5 mt-4`
  * `w-full min-h-[55px]`
  * `border rounded-md`
  * `px-3 py-2 text-sm`

---

### Confirmation Checkbox

* Warning bordered container:

  * `mx-5 mt-3 p-2 border border-red-200 bg-red-50`
* Checkbox:

  * Required before submit.
* Text:

  * "I confirm that I want to deactivate this staff account."
* Confirm text:

  * Highlight "I confirm" in red.

---

### Footer Actions

* Layout:

  * Right aligned buttons.
  * `flex justify-end gap-3`
* Container:

  * `px-5 py-4 border-t`
* Cancel button:

  * White background.
  * Gray border.
  * `hover:bg-gray-50`
* Deactivate button:

  * Disabled until checkbox checked.
  * Red/pink background.
  * `bg-red-400 hover:bg-red-500`

---

# Reactivate Staff Confirmation Modal — UI Specification

### Layout Structure

* Full-screen overlay:

  * `fixed inset-0`
  * Dark blurred backdrop.
* Modal:

  * Center positioned.
  * White rounded container.
* Structure:

  * Header
  * Description
  * Staff summary card
  * Reactivation impact section
  * Confirmation checkbox
  * Footer actions

---

### Header Section

* Layout:

  * `flex items-center justify-between`
* Left:

  * Success/user icon.
  * Title:

    * "Reactivate Staff"
* Right:

  * Close icon.
* Classes:

  * `px-5 py-4 border-b`

---

### Description

* Text:

  * "Reactivate this staff account and restore access to PharmaSync according to the currently assigned role and branch."
* Classes:

  * `text-xs text-gray-500`

---

### Staff Summary Card

* Container:

  * `mx-5 mt-4 p-3 border rounded-md`
* Top row:

  * Staff member name.
  * Status transition badges.
* Bottom row:

  * Role.
  * Branch.
  * Username.
* Grid:

  * `grid grid-cols-3 gap-4`

---

### Status Transition

* Layout:

  * Inactive → Active
* Badge styles:

  * Inactive:

    * `bg-red-100 text-red-600`
  * Active:

    * `bg-teal-100 text-teal-600`

---

### "What Happens After Reactivation" Box

* Container:

  * `mx-5 mt-4 p-3 bg-gray-50 border rounded-md`
* Header:

  * Teal info icon.
  * Uppercase title.
* Bullet items:

  * Staff regains access.
  * Access follows assigned Manager role and Dhanmondi Branch.
  * Existing records remain unchanged.
  * Reactivation recorded in Activity History.
* Classes:

  * `text-xs text-gray-600`

---

### Confirmation Checkbox

* Normal bordered area:

  * `border-gray-200`
* Text:

  * "I confirm that I want to reactivate this staff account."
* Required before action.

---

### Footer Actions

* Layout:

  * `flex justify-end gap-3`
* Cancel:

  * White button.
  * Gray border.
* Reactivate:

  * Disabled before checkbox.
  * Teal primary button:

    * `bg-teal-600 hover:bg-teal-700`
* Text:

  * "Reactivate Staff"

---

## Responsive Behavior (Both Modals)

* Desktop:

  * Center modal.
  * Fixed width.
  * Two/three-column grids.
* Tablet:

  * Reduce padding.
  * Maintain modal width.
* Mobile:

  * Modal width:

    * `w-[calc(100%-32px)]`
  * Single-column staff information.
  * Footer buttons stack:

    * `flex-col`
  * Text wraps naturally.

---

## Interactive States

* Close icon hover state.
* Overlay click closes modal (optional).
* Checkbox required before action button enabled.
* Disabled button opacity:

  * `opacity-50 cursor-not-allowed`
* Loading state:

  * Spinner inside action button.
* Success action:

  * Close modal.
  * Update staff status.
  * Refresh staff list.
