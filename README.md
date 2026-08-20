# Leave Management System

A leave & attendance portal for a US company's India-based employees.
Employees sign in with their Microsoft 365 account, see their CL/SL balance,
and apply for leave. Only two accounts — Bharathkumar and Prithip — can
approve requests, add a leave entry directly for anyone, or see the
attendance log. There's no server to run — it's a static site (hostable
free on GitHub Pages) that reads and writes directly to two SharePoint
Lists in your Microsoft 365 tenant.

**For the full click-by-click setup walkthrough, use `HOSTING-STEPS.md` —
this file is a technical reference, not the guide to follow.**

## How it works

- **Data store:** two SharePoint Lists — `Employees` (master data + opening
  CL/SL balances, imported from your HR export) and `LeaveRequests` (every
  request, with a `Status` of Pending / Approved / Rejected / Cancelled).
- **Balances are computed, not stored as a single number.** Each employee's
  current balance = their opening balance (from `Employees`) minus the days
  from every *Approved* request of that type. This keeps a full, auditable
  history instead of a number that can silently drift.
- **Leave types:** CL (Casual Leave, 12 days) and SL (Sick Leave, 12 days),
  plus Unpaid (no balance cap) for anything beyond that.
- **Approval model:** there's no per-employee manager. Every request goes
  into one shared Pending queue. Two accounts can *see* that queue and the
  attendance log (`js/config.js` → `adminEmails`: Bharathkumar + Prithip),
  but only one can actually *act* on it (`approverEmails`: Prithip only) —
  Bharathkumar's view of admin.html is read-only. The approver can also add
  a leave entry directly for anyone — Approved immediately, no queue — for
  things like backdated corrections or phoned-in sick days. This is
  enforced two ways: the admin UI hides/disables the action buttons for
  non-approvers client-side, *and* the `LeaveRequests` list's item-level
  permissions are set so only SharePoint Owners can edit/approve items (see
  HOSTING-STEPS.md Phase 4) — the second part is what actually stops a
  regular employee from approving their own request via a direct API call.
  HOSTING-STEPS.md Phase 4 also explains the one caveat: this doesn't fully
  lock out Bharathkumar himself unless he removes his own Owner rights
  after setup, since Owner access is needed to administer the site.
- **Auth:** Azure AD (Microsoft Entra) sign-in via MSAL.js. No passwords to
  manage — everyone uses their existing work account.
- **Leave year:** calendar year (resets Jan 1). Holiday calendar: India
  public holidays (edit `data/india-holidays-2026.js` — currently only
  fixed national holidays are filled in; add festival/regional holidays).
- **Balance carry-over:** assumed to NOT carry over year to year (forfeited
  Dec 31). Change this in `js/graph.js` (`computeBalances`) if your policy
  differs.

## Data files in this project

- **`employees_import.xlsx`** — all 33 employees from your HR export
  (Book4.xlsx), already transformed with CLBalance/SLBalance columns added
  (12/12 default). Upload this straight into the SharePoint `Employees` list
  via Import from Excel — no retyping.
- **`employees_template.xlsx`** — a blank template with instructions, useful
  later for adding a new hire one at a time.

Neither file gets uploaded to GitHub — they're for the SharePoint import
step only. See HOSTING-STEPS.md.

## Changing assumptions later

- **Leave year / carry-over:** edit `computeBalances` in `js/graph.js`.
- **Holiday list:** edit `data/india-holidays-2026.js` yearly.
- **Leave types or entitlements:** edit `leaveTypes` in `js/config.js`, and
  add/adjust the matching balance column in the `Employees` list.
- **Admin accounts:** `adminEmails` controls who can view admin.html;
  `approverEmails` (a subset) controls who can actually approve/add leave.
  Update the SharePoint site's Owners group to match any change to
  `approverEmails` (see HOSTING-STEPS.md Phase 4), since that's the part
  that actually enforces it against direct API calls.
- **Notifications:** no email/Teams alerts yet when a request is submitted
  or decided — Power Automate is the natural way to add that later
  (trigger: item created/modified in `LeaveRequests`), without touching
  this app's code.

## File structure

```
leave-mgmt-system/
├── index.html                 Employee view (balance, apply, history)
├── admin.html                  Admin view (approve, add leave, attendance log)
├── css/style.css
├── js/
│   ├── config.js                ← edit this with your tenant/site details
│   ├── auth.js                  MSAL sign-in wrapper
│   ├── graph.js                  SharePoint List read/write via MS Graph
│   ├── dates.js                   Working-day calculator
│   ├── app.js                     Employee page logic
│   └── admin.js                    Admin page logic
├── data/india-holidays-2026.js
├── employees_import.xlsx        Your real data, ready to import — see HOSTING-STEPS.md
├── employees_template.xlsx      Blank template for adding new hires later
└── HOSTING-STEPS.md              ← start here for setup
```
