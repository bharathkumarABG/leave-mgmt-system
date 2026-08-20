let allEmployees = [];
let canApprove = false;

document.getElementById("signInBtn").addEventListener("click", async () => {
  try {
    await signIn();
    await boot();
  } catch (e) {
    document.getElementById("signinError").textContent = e.message;
  }
});

document.getElementById("signOutBtn").addEventListener("click", signOut);

async function boot() {
  const account = await initAuth();
  if (!account) return;

  const email = getCurrentUserEmail();
  if (!isAdmin(email)) {
    document.getElementById("signinScreen").classList.add("hidden");
    document.getElementById("notAdminScreen").classList.remove("hidden");
    return;
  }

  document.getElementById("signinScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
  document.getElementById("userName").textContent = account.name || account.username;

  canApprove = isApprover(email);
  if (!canApprove) {
    document.getElementById("viewOnlyNotice").classList.remove("hidden");
    document.getElementById("addLeaveForm").classList.add("hidden");
    document.getElementById("addLeaveDisabledNotice").classList.remove("hidden");
  }

  populateLeaveTypeOptions();
  allEmployees = await getAllEmployees();
  populateEmployeeOptions();
  await refreshPending();
  await refreshAttendance();
}

function populateLeaveTypeOptions() {
  const select = document.getElementById("directLeaveType");
  select.innerHTML = "";
  window.APP_CONFIG.leaveTypes.forEach((lt) => {
    const opt = document.createElement("option");
    opt.value = lt.key;
    opt.textContent = lt.label;
    select.appendChild(opt);
  });
}

function populateEmployeeOptions() {
  const select = document.getElementById("employeeSelect");
  select.innerHTML = "";
  allEmployees.forEach((emp) => {
    const opt = document.createElement("option");
    opt.value = emp.WorkEmail;
    opt.textContent = `${emp.Name} (${emp.WorkEmail})`;
    select.appendChild(opt);
  });
}

function typeLabel(key) {
  return (window.APP_CONFIG.leaveTypes.find((t) => t.key === key) || {}).label || key;
}

// ---- Pending approvals ----

async function refreshPending() {
  const pending = await getAllPendingRequests();
  const body = document.getElementById("pendingBody");
  const emptyMsg = document.getElementById("emptyPendingMsg");
  body.innerHTML = "";

  if (pending.length === 0) {
    emptyMsg.classList.remove("hidden");
  } else {
    emptyMsg.classList.add("hidden");
  }

  pending.forEach((r) => {
    const tr = document.createElement("tr");
    const actionCell = canApprove
      ? `<button class="approve-btn" data-id="${r.itemId}">Approve</button>
         <button class="reject-btn" data-id="${r.itemId}">Reject</button>`
      : `<span class="muted">Awaiting Prithip</span>`;
    tr.innerHTML = `
      <td>${r.EmployeeEmail}</td>
      <td>${typeLabel(r.LeaveType)}</td>
      <td>${r.StartDate} → ${r.EndDate}</td>
      <td>${r.Days}</td>
      <td>${r.Reason || ""}</td>
      <td class="row-actions">${actionCell}</td>
    `;
    body.appendChild(tr);
  });

  if (!canApprove) return; // view-only — no action handlers to wire up

  body.querySelectorAll(".approve-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      await updateLeaveRequestStatus(btn.dataset.id, "Approved");
      await refreshPending();
      await refreshAttendance();
    });
  });
  body.querySelectorAll(".reject-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      await updateLeaveRequestStatus(btn.dataset.id, "Rejected");
      await refreshPending();
    });
  });
}

// ---- Add leave directly ----

function updateDirectDaysPreview() {
  const start = document.getElementById("directStartDate").value;
  const end = document.getElementById("directEndDate").value;
  const preview = document.getElementById("directDaysPreview");
  if (start && end) {
    const days = countLeaveDays(start, end);
    preview.textContent = `${days} working day(s) will be recorded (weekends & configured holidays excluded).`;
  } else {
    preview.textContent = "";
  }
}
document.getElementById("directStartDate").addEventListener("change", updateDirectDaysPreview);
document.getElementById("directEndDate").addEventListener("change", updateDirectDaysPreview);

document.getElementById("addLeaveForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("directFormError");
  const successEl = document.getElementById("directFormSuccess");
  errorEl.textContent = "";
  successEl.textContent = "";

  if (!canApprove) {
    errorEl.textContent = "Only Prithip can add leave directly.";
    return;
  }

  const employeeEmail = document.getElementById("employeeSelect").value;
  const employee = allEmployees.find((e) => e.WorkEmail === employeeEmail);
  const leaveType = document.getElementById("directLeaveType").value;
  const startDate = document.getElementById("directStartDate").value;
  const endDate = document.getElementById("directEndDate").value;
  const reason = document.getElementById("directReason").value;
  const days = countLeaveDays(startDate, endDate);

  if (!employee) {
    errorEl.textContent = "Select an employee.";
    return;
  }
  if (days <= 0) {
    errorEl.textContent = "Select a valid date range that includes at least one working day.";
    return;
  }

  const ltConfig = window.APP_CONFIG.leaveTypes.find((t) => t.key === leaveType);
  if (ltConfig.balanceField) {
    const balances = await computeBalances(employee);
    if (balances[leaveType] < days) {
      errorEl.textContent = `Heads up: ${employee.Name} only has ${balances[leaveType]} day(s) of ${ltConfig.label} left, but this entry is for ${days}. It will still be recorded — adjust manually if that's not intended.`;
      // Non-blocking for admin — they may be recording something outside normal policy.
    }
  }

  try {
    await createDirectLeaveEntry(
      {
        Title: `${employee.Name} - ${leaveType}`,
        EmployeeEmail: employee.WorkEmail,
        LeaveType: leaveType,
        StartDate: startDate,
        EndDate: endDate,
        Days: days,
        Reason: reason,
      },
      getCurrentUserEmail()
    );
    successEl.textContent = `Recorded ${days} day(s) of ${ltConfig.label} for ${employee.Name}.`;
    document.getElementById("addLeaveForm").reset();
    document.getElementById("directDaysPreview").textContent = "";
    await refreshAttendance();
  } catch (err) {
    errorEl.textContent = "Could not add entry: " + err.message;
  }
});

// ---- Attendance log ----

async function refreshAttendance() {
  const approved = await getAllApprovedRequests();
  const body = document.getElementById("attendanceBody");
  const emptyMsg = document.getElementById("emptyAttendanceMsg");
  body.innerHTML = "";

  if (approved.length === 0) {
    emptyMsg.classList.remove("hidden");
  } else {
    emptyMsg.classList.add("hidden");
  }

  approved.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.EmployeeEmail}</td>
      <td>${typeLabel(r.LeaveType)}</td>
      <td>${r.StartDate} → ${r.EndDate}</td>
      <td>${r.Days}</td>
      <td>${r.DecisionOn || ""}</td>
    `;
    body.appendChild(tr);
  });
}

boot();
