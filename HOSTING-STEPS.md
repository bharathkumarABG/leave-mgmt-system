# Hosting the Leave Portal — Step by Step

No coding needed. This has 6 phases: GitHub, Azure AD, SharePoint, one
permissions step, one config file edit, then testing. Do them in order —
each phase needs something from the one before it.

**How this version works:** every employee signs in and can apply for CL
(Casual Leave) or SL (Sick Leave), starting at 12 days each. Two accounts —
**bharathkumar.mayakrishnan@adamsbridge.com** (you) and
**prithip.kumar@adamsbridge.com** (Prithip) — can open the admin dashboard
and see the pending queue and attendance log. Only **Prithip** can actually
click Approve/Reject or add a leave entry directly — you see everything
read-only. That's already set in `js/config.js` (`adminEmails` vs
`approverEmails`) — nothing to type in again.

Keep a scratch note open — you'll collect 3 values along the way (**Client
ID**, **Tenant ID**, **Site ID**) that all go into that same config file at
the end.

---

## Phase 1 — GitHub: create the repo and upload files

You've done this before for your dashboard, so this will feel familiar —
the only difference is this project has folders (`js`, `css`, `data`)
instead of one file.

1. Unzip `leave-mgmt-system.zip` (the file I sent) somewhere on your
   computer. You should see `index.html`, `admin.html`, a `js` folder,
   `css` folder, `data` folder, `README.md`, `employees_import.xlsx`, and
   `employees_template.xlsx`.
2. Go to [github.com](https://github.com) and sign in.
3. Click the **+** icon (top right) → **New repository**.
4. Name it `leave-mgmt-system` (or anything you like). Leave it **Public**
   (GitHub Pages on the free plan requires a public repo — nothing sensitive
   lives in this code; employee data lives only in SharePoint, behind your
   company login). Don't check "Add a README" — click **Create repository**.
5. On the new empty repo page, click **uploading an existing file**.
6. Drag in `index.html`, `admin.html`, `README.md`, and the `js`, `css`,
   `data` folders together. GitHub preserves the folder structure
   automatically. **Do not upload** `employees_import.xlsx` or
   `employees_template.xlsx` — those are for your reference only, not part
   of the website.
7. Scroll down, click **Commit changes**.
8. Go to the repo's **Settings** tab → **Pages** (left sidebar).
9. Under "Build and deployment", set **Source** to **Deploy from a
   branch**, branch **main**, folder **/(root)**, then **Save**.
10. Wait 1–2 minutes, then refresh — GitHub shows your live URL at the top,
    something like:
    `https://yourusername.github.io/leave-mgmt-system/`

**Write this URL down** — you'll need it in Phase 2. The site won't work
yet (sign-in will show errors) — that's expected until Phases 2–5 are done.

---

## Phase 2 — Register the app in Microsoft Entra admin center

This tells Microsoft 365 to trust your leave portal and lets employees sign
in with their existing work account.

**Before you start:** your employee list uses four different email domains
(adamsbridge.com, adamsbridgehealth.com, adamsbridge.global,
adamsbridge.tech). That's fine as long as all four are verified domains on
the *same* Microsoft 365 tenant — check this under **Settings → Domains**
in the Microsoft 365 admin center. If any of them turn out to belong to a
separate tenant, employees on that domain won't be able to sign in until
that's sorted out — worth a quick check now rather than after go-live.

1. Go to [entra.microsoft.com](https://entra.microsoft.com) and sign in
   with your admin account.
2. In the left menu, go to **Identity → Applications → App registrations**.
3. Click **+ New registration**.
4. Name: `Leave Portal`.
5. Under "Supported account types," leave the default (single tenant).
6. Under **Redirect URI**: choose **Single-page application (SPA)** from the
   dropdown, and paste your GitHub Pages URL from Phase 1 (must end with a
   `/`), e.g. `https://yourusername.github.io/leave-mgmt-system/`.
7. Click **Register**.
8. You'll land on the app's Overview page. Copy these two values into your
   scratch note:
   - **Application (client) ID** → this is your **Client ID**
   - **Directory (tenant) ID** → this is your **Tenant ID**
9. In the left menu (still inside this app), go to **API permissions**.
10. Click **+ Add a permission → Microsoft Graph → Delegated permissions**.
11. Search for and check: `Sites.ReadWrite.All` and `User.Read`. Click
    **Add permissions**.
12. Back on the API permissions page, click **Grant admin consent for
    [your organization]** → **Yes**. You should see green checkmarks next
    to both permissions afterward.

---

## Phase 3 — Create the SharePoint site and two lists

1. Go to [sharepoint.com](https://www.office.com/launchapp?app=SharePoint)
   (or from office.com, click the app grid → SharePoint).
2. Click **+ Create site** → **Team site**. Name it `Leave Portal`. Click
   **Finish**.
3. On the new site, click **+ New → List**.
4. Choose **Blank list**, name it exactly `Employees`, click **Create**.
5. Add these columns (**+ Add column** for each, with the type shown):

   | Column name | Type |
   |---|---|
   | Name | Single line of text |
   | WorkEmail | Single line of text |
   | Department | Single line of text |
   | Designation | Single line of text |
   | Level | Single line of text |
   | EmploymentType | Single line of text |
   | DateOfJoining | Date |
   | YearsOfExperience | Number |
   | ABGCode | Single line of text |
   | CLBalance | Number |
   | SLBalance | Number |

   The list already has a built-in **Title** column — rename it to
   `EmployeeID` (click the column header → **Rename**).

6. Fill in all 33 employees at once: click **+ New → Import from Excel**
   (or the "Import Spreadsheet" option under **+ New**), and upload
   `employees_import.xlsx` — every employee from your HR export is already
   in there with CL/SL balances pre-filled at 12/12, so this is a single
   upload, not manual typing. Match each Excel column to the SharePoint
   column of the same name when prompted.

7. Back on the site, click **+ New → List → Blank list** again. Name it
   exactly `LeaveRequests`. Click **Create**. Leave it empty — the app
   fills it in automatically as people apply.
8. Add these columns to `LeaveRequests`:

   | Column name | Type |
   |---|---|
   | EmployeeEmail | Single line of text |
   | LeaveType | Choice — add these choices: CL, SL, Unpaid |
   | StartDate | Date |
   | EndDate | Date |
   | Days | Number |
   | Reason | Multiple lines of text |
   | Status | Choice — add these choices: Pending, Approved, Rejected, Cancelled (set default value to Pending) |
   | DecisionOn | Date |
   | DecisionNote | Single line of text |

---

## Phase 4 — Lock down who can approve (important)

This is the step that actually enforces the approval rules — without it,
the admin screen just *hides* the approve buttons from people who shouldn't
use them, but a technically savvy person could still call the same
Microsoft API directly and approve their own request. This step closes that
gap at the SharePoint level, for regular employees at least — read the note
at the end about what it does and doesn't cover for you specifically.

1. On the `LeaveRequests` list, click the gear icon (top right) → **List
   settings**.
2. Click **Advanced settings**.
3. Find **Item-level Permissions**. Under "Edit access," choose **None**.
   Leave "Read access" as **Read all items**. Click **OK**.
   This means regular employees can still *create* their own leave requests
   (that permission comes from their site membership, not this setting),
   but nobody except a site Owner can edit or approve any request — not
   even their own.
4. Now check who's an Owner: go back to the site home, click the gear icon
   → **Site permissions** → **Advanced permissions settings**.
5. Under the **Owners** group, make sure `prithip.kumar@adamsbridge.com` is
   listed (add him if not) — he needs this to actually approve/reject and
   add leave directly, since that's what lets him bypass the "Edit: None"
   restriction from step 3.
6. Under the **Members** group, add everyone else (or your whole company's
   Microsoft 365 group if you have one) — Members can read the lists and
   create their own leave requests, but — because of step 3 — cannot edit
   or approve anything.

**About your own access:** you'll need to stay an Owner too, at least
through setup, since creating the site/lists and changing these permission
settings requires it. That means the app's UI won't show you Approve/Reject
buttons (per Phase-6 config), but as a SharePoint Owner you technically
*could* still edit a request directly in SharePoint if you wanted to — the
restriction on you is enforced by the app, not by SharePoint itself. If you
want it airtight even for your own account, you'd move yourself from
Owners to Members once setup is done, and temporarily re-add yourself as
Owner whenever you need to administer the site (add employees, change
columns, etc.) — you always can, since it's your Microsoft 365 tenant.
Most people find the app-level restriction good enough day to day; this is
just so you know exactly what it does and doesn't guarantee.

---

## Phase 5 — Get your Site ID

1. Go to [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer).
2. Click **Sign in** (top right) and sign in with your admin account.
3. In the query box at the top, replace the URL with:
   ```
   https://graph.microsoft.com/v1.0/sites/yourtenant.sharepoint.com:/sites/Leave Portal
   ```
   Replace `yourtenant` with your actual Microsoft 365 domain (check your
   browser's address bar on the SharePoint site from Phase 3), and
   `Leave Portal` with your exact site name.
4. Click **Run query**.
5. In the response on the right, find the `"id"` field near the top — it
   looks like `yourtenant.sharepoint.com,xxxxxxxx-xxxx-...,yyyyyyyy-yyyy-...`.
6. Copy that whole value into your scratch note as your **Site ID**.

---

## Phase 6 — Fill in the one config file and re-upload

1. On your computer, open the `js` folder from your unzipped project, and
   open `config.js` in a plain text editor (Notepad on Windows, TextEdit on
   Mac — right-click the file → Open With → a text editor).
2. Find these lines and replace the placeholder text (keep the quotation
   marks):
   ```
   clientId: "PASTE-YOUR-APP-CLIENT-ID-HERE",
   authority: "https://login.microsoftonline.com/PASTE-YOUR-TENANT-ID-HERE",
   ```
   and further down:
   ```
   siteId: "PASTE-YOUR-SHAREPOINT-SITE-ID-HERE",
   ```
   Paste in the **Client ID**, **Tenant ID** (after the last `/` in the
   authority line), and **Site ID** you collected in Phases 2 and 5. Leave
   `adminEmails` and `approverEmails` as they are — already set correctly
   (both of you can view the dashboard, only Prithip can act on it).
3. Save the file.
4. Back on your GitHub repo page, navigate into the `js` folder, click
   `config.js`, then click the pencil (✏️) **Edit** icon.
5. Select all the existing text (Ctrl+A / Cmd+A), delete it, and paste in
   your updated file's contents.
6. Scroll down, click **Commit changes**.
7. Wait about a minute for GitHub Pages to redeploy.

---

## Phase 7 — Test it

1. Open your GitHub Pages URL from Phase 1.
2. Sign in as any employee from the Employees list (not you or Prithip) —
   confirm you see their CL/SL balances (12/12 if unused) and can submit a
   request.
3. Sign in as **yourself** (Bharathkumar) at `[your-site-url]/admin.html` —
   you should see the pending request and the "view-only" notice, with no
   Approve/Reject buttons and the "Add leave directly" form replaced by a
   message. This confirms you can see everything but not act on it.
4. Sign in as **Prithip** on `admin.html` — he should see Approve/Reject
   buttons. Have him click **Approve**, then reload the employee's page —
   their balance should have dropped by the number of days approved.
5. Still signed in as Prithip, try **Add leave directly** for a different
   employee — it should show up immediately in the **Attendance log** below
   and reduce that employee's balance without needing approval.
6. Sign in as an employee who is *not* Bharathkumar or Prithip on
   `admin.html` — you should see "Not authorized," confirming the lockout
   works.

If sign-in fails with a permissions error, double-check Phase 2 step 12
(admin consent shows green checkmarks). If the page loads but shows no
data, double-check the Site ID and that list/column names match exactly,
case-sensitive (`Employees`, `LeaveRequests`, `CLBalance`, `SLBalance`).

---

## If you get stuck

Tell me exactly which phase and step, and what you're seeing on screen (a
screenshot helps a lot) — I can troubleshoot from there.
