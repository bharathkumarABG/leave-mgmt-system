let currentEmployee = null;

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
  if (!account) return; // stay on sign-in screen

  document.getElementById("signinScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
  document.getElementById("userName").textContent = account.name || account.username;

  const email = getCurrentUserEmail();
  if (isAdmin(email)) {
    document.getElementById("adminLink").classList.remove("hidden");
  }
  currentEmployee = await getEmployeeByEmail(email);

  if (!currentEmployee) {
    document.querySelector("#appScreen main").innerHTML =
      `<div class="card"><h2>No employee record found</h2>
       <p class="muted">No row in the Employees list matches ${email}. Ask HR to add you, then refresh.</p>
       </div>`;
    return;
  }

  populateLeaveTypeOptions();
  await refreshBalances();
  await refreshRequests();
}

function populateLeaveTypeOptions() {
  const select = document.getElementById("leaveType");
  select.innerHTML = "";
  window.APP_CONFIG.leaveTypes.forEach((lt) => {
    const opt = document.createElement("option");
    opt.value = lt.key;
    opt.textContent = lt.label;
    select.appendChild(opt);
  });
}

async function refreshBalances() {
  const balances = await computeBalances(currentEmployee);
  const grid = document.getElementById("balancesGrid");
  grid.innerHTML = "";
  window.APP_CONFIG.leaveTypes.forEach((lt) => {
    const val = balances[lt.key];
    const tile = document.createElement("div");
    tile.className = "balance-tile";
    tile.innerHTML = `<div class="num">${val === null ? "—" : val}</div>
                       <div class="label">${lt.label}</div>`;
    grid.appendChild(tile);
  });
}

async function refreshRequests() {
  const requests = await getLeaveRequestsForEmployee(currentEmployee.WorkEmail);
  const body = document.getElementById("requestsBody");
  body.innerHTML = "";
  requests.forEach((r) => {
    const typeLabel = (window.APP_CONFIG.leaveTypes.find((t) => t.key === r.LeaveType) || {}).label || r.LeaveType;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${typeLabel}</td>
      <td>${r.StartDate} → ${r.EndDate}</td>
      <td>${r.Days}</td>
      <td><span class="status ${r.Status}">${r.Status}</span></td>
      <td>${r.Status === "Pending" ? `<button class="cancel-btn" data-id="${r.itemId}">Cancel</button>` : ""}</td>
    `;
    body.appendChild(tr);
  });
  body.querySelectorAll(".cancel-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      await cancelLeaveRequest(btn.dataset.id);
      await refreshRequests();
      await refreshBalances();
    });
  });
}

function updateDaysPreview() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  const preview = document.getElementById("daysPreview");
  if (start && end) {
    const days = countLeaveDays(start, end);
    preview.textContent = `${days} working day(s) will be requested (weekends & configured holidays excluded).`;
  } else {
    preview.textContent = "";
  }
}
document.getElementById("startDate").addEventListener("change", updateDaysPreview);
document.getElementById("endDate").addEventListener("change", updateDaysPreview);

document.getElementById("leaveForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("formError");
  const successEl = document.getElementById("formSuccess");
  errorEl.textContent = "";
  successEl.textContent = "";

  const leaveType = document.getElementById("leaveType").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const reason = document.getElementById("reason").value;
  const days = countLeaveDays(startDate, endDate);

  if (days <= 0) {
    errorEl.textContent = "Select a valid date range that includes at least one working day.";
    return;
  }

  const ltConfig = window.APP_CONFIG.leaveTypes.find((t) => t.key === leaveType);
  if (ltConfig.balanceField) {
    const balances = await computeBalances(currentEmployee);
    if (balances[leaveType] < days) {
      errorEl.textContent = `Insufficient balance: you have ${balances[leaveType]} day(s) of ${ltConfig.label} left, but requested ${days}.`;
      return;
    }
  }

  try {
    await createLeaveRequest({
      Title: `${currentEmployee.Name} - ${leaveType}`,
      EmployeeEmail: currentEmployee.WorkEmail,
      LeaveType: leaveType,
      StartDate: startDate,
      EndDate: endDate,
      Days: days,
      Reason: reason,
      Status: "Pending",
    });
    successEl.textContent = "Request submitted — awaiting admin approval.";
    document.getElementById("leaveForm").reset();
    document.getElementById("daysPreview").textContent = "";
    await refreshRequests();
  } catch (err) {
    errorEl.textContent = "Could not submit request: " + err.message;
  }
});

boot();
