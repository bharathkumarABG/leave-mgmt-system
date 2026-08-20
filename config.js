/*
  ============================================================
  CONFIGURATION — fill these in after completing the setup
  steps in README.md. Nothing else in the app needs editing.
  ============================================================
*/
window.APP_CONFIG = {
  // --- Azure AD app registration (Entra admin center) ---
  msal: {
    clientId: "PASTE-YOUR-APP-CLIENT-ID-HERE",
    authority: "https://login.microsoftonline.com/PASTE-YOUR-TENANT-ID-HERE",
    // Must exactly match a Redirect URI configured on the app registration,
    // e.g. https://yourusername.github.io/leave-mgmt-system/
    redirectUri: window.location.origin + window.location.pathname.replace(/[^/]+$/, ""),
  },

  // Delegated Graph permission requested at login.
  // Sites.ReadWrite.All is simplest; Sites.Selected is more restrictive
  // (see README "Tighter permissions" section) if your admin prefers that.
  graphScopes: ["Sites.ReadWrite.All", "User.Read"],

  // --- SharePoint site & lists ---
  // siteId looks like: contoso.sharepoint.com,GUID,GUID
  // Get it via: GET https://graph.microsoft.com/v1.0/sites/{hostname}:/sites/{site-name}
  siteId: "PASTE-YOUR-SHAREPOINT-SITE-ID-HERE",
  lists: {
    employees: "Employees",
    leaveRequests: "LeaveRequests",
  },

  // Only these accounts can see admin.html at all (the pending queue and the
  // attendance log). Everyone else can only view their own balance and apply
  // for leave. This is a client-side gate for a clean UI — the real security
  // boundary is the SharePoint item-level permission set in
  // HOSTING-STEPS.md, which stops employees from editing/approving requests
  // even by calling the Graph API directly.
  adminEmails: [
    "bharathkumar.mayakrishnan@adamsbridge.com",
    "prithip.kumar@adamsbridge.com",
  ],

  // Of the admins above, only these can actually click Approve/Reject or use
  // "Add leave directly" — everyone else in adminEmails sees the dashboard
  // read-only. Right now that means Prithip is the sole approver; you
  // (Bharathkumar) can see the queue and attendance log but not act on them.
  approverEmails: [
    "prithip.kumar@adamsbridge.com",
  ],

  // Leave types this instance supports (must match the SharePoint
  // "LeaveType" choice column and the Employees balance columns below).
  leaveTypes: [
    { key: "CL",     label: "Casual Leave", balanceField: "CLBalance" },
    { key: "SL",     label: "Sick Leave",   balanceField: "SLBalance" },
    { key: "Unpaid", label: "Unpaid Leave", balanceField: null }, // no balance limit
  ],

  // Leave year model: resets every Jan 1 (calendar year), India holiday calendar.
  leaveYearStart: { month: 1, day: 1 },
};
