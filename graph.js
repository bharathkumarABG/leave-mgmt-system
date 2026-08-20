/*
  Microsoft Graph helpers for reading/writing the SharePoint Lists
  that act as this app's database (Employees, LeaveRequests).
*/

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphFetch(path, options = {}) {
  const token = await getGraphToken();
  const res = await fetch(GRAPH_BASE + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API error ${res.status}: ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function listPath(listKey) {
  const listName = window.APP_CONFIG.lists[listKey];
  return `/sites/${window.APP_CONFIG.siteId}/lists/${encodeURIComponent(listName)}`;
}

// ---- Employees ----

async function getEmployeeByEmail(email) {
  const filter = encodeURIComponent(`fields/WorkEmail eq '${email}'`);
  const data = await graphFetch(
    `${listPath("employees")}/items?expand=fields&$filter=${filter}`
  );
  if (!data.value || data.value.length === 0) return null;
  const item = data.value[0];
  return { itemId: item.id, ...item.fields };
}

async function getAllEmployees() {
  const data = await graphFetch(
    `${listPath("employees")}/items?expand=fields&$orderby=fields/Name asc&$top=200`
  );
  return (data.value || []).map((item) => ({ itemId: item.id, ...item.fields }));
}

function isAdmin(email) {
  if (!email) return false;
  const list = (window.APP_CONFIG.adminEmails || []).map((e) => e.toLowerCase());
  return list.includes(email.toLowerCase());
}

function isApprover(email) {
  if (!email) return false;
  const list = (window.APP_CONFIG.approverEmails || []).map((e) => e.toLowerCase());
  return list.includes(email.toLowerCase());
}

// ---- Leave requests ----

async function getLeaveRequestsForEmployee(email) {
  const filter = encodeURIComponent(`fields/EmployeeEmail eq '${email}'`);
  const data = await graphFetch(
    `${listPath("leaveRequests")}/items?expand=fields&$filter=${filter}&$orderby=fields/StartDate desc`
  );
  return (data.value || []).map((item) => ({ itemId: item.id, ...item.fields }));
}

async function getAllPendingRequests() {
  const filter = encodeURIComponent(`fields/Status eq 'Pending'`);
  const data = await graphFetch(
    `${listPath("leaveRequests")}/items?expand=fields&$filter=${filter}&$orderby=fields/StartDate asc`
  );
  return (data.value || []).map((item) => ({ itemId: item.id, ...item.fields }));
}

async function getAllApprovedRequests() {
  const filter = encodeURIComponent(`fields/Status eq 'Approved'`);
  const data = await graphFetch(
    `${listPath("leaveRequests")}/items?expand=fields&$filter=${filter}&$orderby=fields/StartDate desc&$top=500`
  );
  return (data.value || []).map((item) => ({ itemId: item.id, ...item.fields }));
}

async function getApprovedRequestsForEmployee(email, leaveType) {
  const filter = encodeURIComponent(
    `fields/EmployeeEmail eq '${email}' and fields/LeaveType eq '${leaveType}' and fields/Status eq 'Approved'`
  );
  const data = await graphFetch(
    `${listPath("leaveRequests")}/items?expand=fields&$filter=${filter}`
  );
  return (data.value || []).map((item) => ({ itemId: item.id, ...item.fields }));
}

async function createLeaveRequest(request) {
  return graphFetch(`${listPath("leaveRequests")}/items`, {
    method: "POST",
    body: JSON.stringify({ fields: request }),
  });
}

// Admin adds a leave entry directly (e.g. backdated, phoned-in sick day).
// Skips the Pending queue entirely — it's Approved from the moment it's created.
async function createDirectLeaveEntry(entry, addedByEmail) {
  return graphFetch(`${listPath("leaveRequests")}/items`, {
    method: "POST",
    body: JSON.stringify({
      fields: {
        ...entry,
        Status: "Approved",
        DecisionOn: new Date().toISOString().slice(0, 10),
        DecisionNote: `Added directly by admin (${addedByEmail})`,
      },
    }),
  });
}

async function updateLeaveRequestStatus(itemId, status, decisionNote) {
  return graphFetch(`${listPath("leaveRequests")}/items/${itemId}/fields`, {
    method: "PATCH",
    body: JSON.stringify({
      Status: status,
      DecisionOn: new Date().toISOString().slice(0, 10),
      DecisionNote: decisionNote || "",
    }),
  });
}

async function cancelLeaveRequest(itemId) {
  return updateLeaveRequestStatus(itemId, "Cancelled", "Cancelled by employee");
}

// ---- Balance calculation (ledger model: opening balance minus approved days) ----

async function computeBalances(employee) {
  const results = {};
  for (const lt of window.APP_CONFIG.leaveTypes) {
    if (!lt.balanceField) {
      results[lt.key] = null; // e.g. Unpaid — no cap
      continue;
    }
    const opening = Number(employee[lt.balanceField] || 0);
    const approved = await getApprovedRequestsForEmployee(employee.WorkEmail, lt.key);
    const used = approved.reduce((sum, r) => sum + Number(r.Days || 0), 0);
    results[lt.key] = opening - used;
  }
  return results;
}
