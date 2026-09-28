const API = String(window.NM_CONFIG?.API_BASE_URL || "").replace(/\/$/, "");

const state = {
  token: localStorage.getItem("nm_token") || null,
  shopName: localStorage.getItem("nm_shop_name") || "Nadeem Mobiles",
  currentView: "overview",
  stats: {}, customers: [], payments: [], devices: [], enrollments: [], activity: [],
  customerSearch: "",
  paymentCustomerFilter: "all"
};

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>\"]/g, (s) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[s]));
const num = (v) => Number(v || 0);
const money = (v) => `Rs. ${num(v).toLocaleString("en-PK", {maximumFractionDigits: 2})}`;
const fmtDate = (v) => {
  if (!v) return "—";
  const s = String(v);
  const d = new Date(s.includes("T") || s.endsWith("Z") ? s : `${s.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleString();
};

function toast(message, type = "") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  $("toastHost").appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

function setConnection(ok, label) {
  $("connectionLabel").textContent = label;
  $("connectionDot").classList.toggle("ok", ok);
  $("connectionDot").classList.toggle("bad", !ok);
}

function statusBadge(status) {
  const map = {
    pending: ["pending", "Pending"], unlocked: ["enrolled", "Enrolled"], locked: ["locked", "Locked"],
    release_pending: ["releasing", "Release pending"], released: ["released", "Released"]
  };
  const [klass, label] = map[status] || ["pending", status || "Unknown"];
  return `<span class="status ${klass}">${esc(label)}</span>`;
}

function apiError(data, status) {
  return new Error(data?.error || `Request failed (${status})`);
}

async function api(path, options = {}) {
  if (!API) throw new Error("Dashboard API is not configured.");
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body !== undefined) headers.set("Content-Type", "application/json");
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
  const res = await fetch(`${API}${path}`, { ...options, headers, cache: "no-store" });
  const raw = await res.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw || `Request failed (${res.status})` }; }
  if (res.status === 401 && path !== "/api/login") {
    logout(false);
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) throw apiError(data, res.status);
  return data;
}

async function loadAll() {
  try {
    const [stats, customers, payments, devices, enrollments, activity] = await Promise.all([
      api("/api/stats"), api("/api/customers"), api("/api/payments"),
      api("/api/devices"), api("/api/enrollments"), api("/api/activity")
    ]);
    state.stats = stats || {};
    state.customers = customers || [];
    state.payments = payments || [];
    state.devices = devices || [];
    state.enrollments = enrollments || [];
    state.activity = activity || [];
    setConnection(true, "Backend connected");
    render();
  } catch (err) {
    setConnection(false, "Backend unavailable");
    toast(err.message, "bad");
  }
}

function setView(view) {
  state.currentView = view;
  render();
}

function render() {
  const titles = {overview:"Overview",customers:"Customers",payments:"Payments",devices:"Devices",enrollments:"Enrollments",activity:"Activity",settings:"Settings"};
  $("pageTitle").textContent = titles[state.currentView] || "Overview";
  $("pageEyebrow").textContent = state.shopName;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === state.currentView));
  const map = {
    overview: renderOverview,
    customers: renderCustomers,
    payments: renderPayments,
    devices: renderDevices,
    enrollments: renderEnrollments,
    activity: renderActivity,
    settings: renderSettings
  };
  $("content").innerHTML = (map[state.currentView] || renderOverview)();
  bindContentEvents();
}

function renderOverview() {
  const total = num(state.stats.total_amount), paid = num(state.stats.paid_amount), outstanding = num(state.stats.outstanding);
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const enrolled = num(state.stats.active) + num(state.stats.locked);
  const recent = state.activity.slice(0, 8);
  return `
    <div class="metrics">
      <div class="metric"><div class="label">Customers</div><div class="value">${num(state.stats.total)}</div><div class="sub">All customer records</div></div>
      <div class="metric good"><div class="label">Enrolled devices</div><div class="value">${enrolled}</div><div class="sub">${num(state.stats.active)} unlocked · ${num(state.stats.locked)} locked</div></div>
      <div class="metric warn"><div class="label">Outstanding</div><div class="value">${money(outstanding)}</div><div class="sub">${num(state.stats.overdue)} overdue · ${num(state.stats.dueSoon)} due in 7 days</div></div>
      <div class="metric"><div class="label">Collected</div><div class="value">${money(paid)}</div><div class="sub">${pct}% of recorded total</div></div>
    </div>
    <div class="grid-2">
      <section class="card"><div class="card-head"><h3>Payment progress</h3><span class="muted">${pct}% collected</span></div><div class="card-body">
        <div class="progress-row"><span>Total</span><strong>${money(total)}</strong></div><div class="bar"><div style="width:${pct}%"></div></div>
        <div class="progress-row" style="margin-top:13px"><span>Paid</span><strong>${money(paid)}</strong></div>
        <div class="progress-row"><span>Outstanding</span><strong>${money(outstanding)}</strong></div>
      </div></section>
      <section class="card"><div class="card-head"><h3>Quick actions</h3></div><div class="card-body"><div class="quick-grid">
        <button class="quick" data-action="new-customer"><strong>+ New customer</strong><span>Generate a 6-digit pairing code</span></button>
        <button class="quick" data-view="payments"><strong>Record payment</strong><span>Update a customer balance</span></button>
        <button class="quick" data-view="devices"><strong>Manage devices</strong><span>Lock, unlock or release</span></button>
        <button class="quick" data-view="enrollments"><strong>View enrollments</strong><span>Pair, regenerate or re-enroll</span></button>
      </div></div></section>
    </div>
    <section class="card" style="margin-top:14px"><div class="card-head"><h3>Recent activity</h3><button class="mini-btn" data-view="activity">View all</button></div>
      <div class="activity-list">${recent.length ? recent.map(renderActivityRow).join("") : `<div class="empty">No activity yet.</div>`}</div>
    </section>`;
}

function renderActivityRow(item) {
  const customer = item.customer_name ? esc(item.customer_name) : "System";
  return `<div class="activity-row"><div class="activity-dot"></div><div class="activity-main"><strong>${customer}</strong> — ${esc(item.action || "event")}<div class="activity-detail">${esc(item.detail || "")}</div></div><div class="activity-time">${fmtDate(item.at)}</div></div>`;
}

function renderCustomers() {
  const q = state.customerSearch.trim().toLowerCase();
  const rows = state.customers.filter((c) => !q || `${c.name} ${c.phone_number}`.toLowerCase().includes(q));
  return `<div class="toolbar"><div class="left"><input class="search" id="customerSearch" value="${esc(state.customerSearch)}" placeholder="Search customer or phone…"></div><div class="right"><button class="btn primary" data-action="new-customer">+ New customer</button></div></div>
    <section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Device</th><th>Balance</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${rows.length ? rows.map((c) => `<tr>
        <td><div class="customer-name">${esc(c.name)}</div><div class="customer-meta">${esc(c.phone_number)}</div></td>
        <td>${esc(c.device_model || "Not paired")}</td>
        <td><div class="money">${money(c.outstanding)}</div><div class="customer-meta">${money(c.paid_amount)} paid</div></td>
        <td>${esc(c.next_due_date || "—")}${num(c.overdue) ? `<div class="customer-meta" style="color:#ff9696">Overdue</div>` : ""}</td>
        <td>${statusBadge(c.status)}</td>
        <td><div class="actions">
          <button class="mini-btn" data-action="details" data-id="${c.id}">Details</button>
          <button class="mini-btn" data-action="payment" data-id="${c.id}">Payment</button>
          ${c.status === "pending" ? `<button class="mini-btn" data-action="code" data-id="${c.id}">Pairing code</button>` : ""}
          ${c.status === "unlocked" ? `<button class="mini-btn lock" data-action="lock" data-id="${c.id}">Lock</button>` : ""}
          ${c.status === "locked" ? `<button class="mini-btn unlock" data-action="unlock" data-id="${c.id}">Unlock</button>` : ""}
          ${["unlocked","locked"].includes(c.status) ? `<button class="mini-btn release" data-action="release" data-id="${c.id}">Release</button>` : ""}
          ${c.status === "released" ? `<button class="mini-btn" data-action="reenroll" data-id="${c.id}">Re-enroll</button>` : ""}
          ${c.status === "pending" ? `<button class="mini-btn" data-action="regenerate" data-id="${c.id}">New code</button>` : ""}
          ${!c.fcm_token ? `<button class="mini-btn delete" data-action="delete-customer" data-id="${c.id}">Delete</button>` : ""}
        </div></td>
      </tr>`).join("") : `<tr><td colspan="6" class="empty">No customers found.</td></tr>`}
    </tbody></table></div></section>`;
}

function renderPayments() {
  const filtered = state.paymentCustomerFilter === "all" ? state.payments : state.payments.filter((p) => String(p.customer_id) === String(state.paymentCustomerFilter));
  return `<div class="toolbar"><div class="left"><strong>${filtered.length}</strong><span class="muted">payment${filtered.length === 1 ? "" : "s"}</span><select id="paymentCustomerFilter"><option value="all">All customers</option>${state.customers.map((c) => `<option value="${c.id}" ${String(state.paymentCustomerFilter) === String(c.id) ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div><div class="right"><button class="btn primary" data-action="record-payment">+ Record payment</button></div></div>
  <section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Amount</th><th>Paid at</th><th>Reference</th><th>Note</th><th>Action</th></tr></thead><tbody>
    ${filtered.length ? filtered.map((p) => `<tr><td><div class="customer-name">${esc(p.customer_name)}</div><div class="customer-meta">${esc(p.phone_number)}</div></td><td class="money">${money(p.amount)}</td><td>${fmtDate(p.paid_at)}</td><td>${esc(p.reference || "—")}</td><td>${esc(p.note || "—")}</td><td><button class="mini-btn delete" data-action="delete-payment" data-id="${p.id}">Delete</button></td></tr>`).join("") : `<tr><td colspan="6" class="empty">No payments recorded.</td></tr>`}
  </tbody></table></div></section>`;
}

function renderDevices() {
  return `<section class="card"><div class="card-head"><div><h3>Managed devices</h3><div class="muted" style="font-size:12px;margin-top:3px">Each row is a customer enrollment and its current device state.</div></div><button class="mini-btn" data-view="enrollments">Open enrollments</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Phone</th><th>Model</th><th>Status</th><th>Last seen</th><th>Actions</th></tr></thead><tbody>
    ${state.devices.length ? state.devices.map((d) => `<tr><td><div class="customer-name">${esc(d.name)}</div></td><td>${esc(d.phone_number)}</td><td>${esc(d.device_model || "—")}</td><td>${statusBadge(d.status)}</td><td>${fmtDate(d.last_seen)}</td><td><div class="actions">
      ${d.status === "unlocked" ? `<button class="mini-btn lock" data-action="lock" data-id="${d.id}">Lock</button>` : ""}
      ${d.status === "locked" ? `<button class="mini-btn unlock" data-action="unlock" data-id="${d.id}">Unlock</button>` : ""}
      ${["unlocked","locked"].includes(d.status) ? `<button class="mini-btn release" data-action="release" data-id="${d.id}">Release</button>` : ""}
      ${d.status === "released" ? `<button class="mini-btn" data-action="reenroll" data-id="${d.id}">Re-enroll</button>` : ""}
    </div></td></tr>`).join("") : `<tr><td colspan="6" class="empty">No enrolled devices yet.</td></tr>`}
  </tbody></table></div></section>`;
}

function renderEnrollments() {
  return `<section class="card"><div class="card-head"><div><h3>Enrollments</h3><div class="muted" style="font-size:12px;margin-top:3px">Pair new phones, regenerate unused codes and re-enroll released devices.</div></div><button class="btn primary" data-action="new-customer">+ New enrollment</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Pairing code</th><th>Device</th><th>Status</th><th>Last seen</th><th>Actions</th></tr></thead><tbody>
    ${state.enrollments.length ? state.enrollments.map((e) => `<tr><td><div class="customer-name">${esc(e.name)}</div><div class="customer-meta">${esc(e.phone_number)}</div></td><td>${e.pairing_code ? `<strong>${esc(e.pairing_code)}</strong>` : "—"}</td><td>${esc(e.device_model || "Not paired")}</td><td>${statusBadge(e.status)}</td><td>${fmtDate(e.last_seen)}</td><td><div class="actions">
      ${e.status === "pending" ? `<button class="mini-btn" data-action="code" data-id="${e.id}">Show code</button><button class="mini-btn" data-action="regenerate" data-id="${e.id}">Regenerate</button>` : ""}
      ${e.status === "released" ? `<button class="mini-btn" data-action="reenroll" data-id="${e.id}">Re-enroll</button>` : ""}
      ${e.status === "unlocked" ? `<button class="mini-btn lock" data-action="lock" data-id="${e.id}">Lock</button>` : ""}
      ${e.status === "locked" ? `<button class="mini-btn unlock" data-action="unlock" data-id="${e.id}">Unlock</button>` : ""}
      ${["unlocked","locked"].includes(e.status) ? `<button class="mini-btn release" data-action="release" data-id="${e.id}">Release</button>` : ""}
    </div></td></tr>`).join("") : `<tr><td colspan="6" class="empty">No enrollments yet.</td></tr>`}
  </tbody></table></div></section>`;
}

function renderActivity() {
  return `<section class="card"><div class="card-head"><h3>Activity log</h3><span class="muted" style="font-size:12px">Latest ${state.activity.length} events</span></div><div class="activity-list">${state.activity.length ? state.activity.map(renderActivityRow).join("") : `<div class="empty">No activity yet.</div>`}</div></section>`;
}

function renderSettings() {
  return `<div class="grid-2" style="margin-top:0">
    <section class="card"><div class="card-head"><h3>Connection</h3></div><div class="card-body">
      <div class="detail-grid" style="grid-template-columns:1fr"><div class="detail-tile"><span>Dashboard API</span><strong style="word-break:break-all">${esc(API || "Not configured")}</strong></div><div class="detail-tile"><span>Status</span><strong>${esc($("connectionLabel")?.textContent || "Unknown")}</strong></div></div>
      <div class="modal-actions" style="margin-top:14px"><button class="btn" data-action="health-check">Check API health</button></div>
    </div></section>
    <section class="card"><div class="card-head"><h3>Account</h3></div><div class="card-body">
      <div class="detail-grid" style="grid-template-columns:1fr"><div class="detail-tile"><span>Shop</span><strong>${esc(state.shopName)}</strong></div><div class="detail-tile"><span>Signed in as</span><strong>admin</strong></div></div>
      <div class="notice" style="margin-top:14px">The dashboard does not display or manage server secrets here. Cloudflare stores API secrets separately from this site.</div>
    </div></section>
  </div>`;
}

function modal(title, body) {
  return `<div class="modal-backdrop" data-modal-backdrop><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h3>${title}</h3><button class="close-btn" type="button" data-close-modal aria-label="Close">×</button></div><div class="modal-body">${body}</div></div></div>`;
}

function openModal(html) { $("modalHost").innerHTML = html; }
function closeModal() { $("modalHost").innerHTML = ""; }

function customerForm(existing = null) {
  const edit = Boolean(existing);
  return modal(edit ? `Edit customer — ${esc(existing.name)}` : "New customer", `<form id="customerForm" class="form-grid" data-id="${edit ? existing.id : ""}">
    <label>Customer name<input id="fName" required maxlength="120" value="${esc(existing?.name || "")}"></label>
    <label>Phone number<input id="fPhone" required maxlength="40" value="${esc(existing?.phone_number || "")}"></label>
    <label>Total amount<input id="fTotal" type="number" min="0" step="0.01" value="${existing ? esc(existing.total_amount) : "0"}"></label>
    <label>Installment amount<input id="fInstallment" type="number" min="0" step="0.01" placeholder="Optional" value="${existing?.installment_amount != null ? esc(existing.installment_amount) : ""}"></label>
    <label>Next due date<input id="fDue" type="date" value="${esc(existing?.next_due_date || "")}"></label>
    <label>Notes<input id="fNotes" maxlength="300" placeholder="Optional" value="${esc(existing?.notes || "")}"></label>
    ${!edit ? `<div class="span2 notice">A one-time 6-digit pairing code will be generated after creation. The customer enters only that code in the phone app.</div>` : ""}
    <div class="span2 modal-actions"><button type="button" class="btn ghost" data-close-modal>Cancel</button><button class="btn primary" type="submit">${edit ? "Save changes" : "Create & show code"}</button></div>
  </form>`);
}

function paymentModal(customer) {
  return modal(`Record payment — ${esc(customer.name)}`, `<form id="paymentForm" class="form-grid" data-customer-id="${customer.id}">
    <label>Amount<input id="pAmount" type="number" min="0.01" step="0.01" required></label>
    <label>Reference<input id="pRef" maxlength="100" placeholder="Receipt / transaction #"></label>
    <label class="span2">Note<input id="pNote" maxlength="200" placeholder="Optional"></label>
    <div class="span2 notice">Current outstanding: <strong>${money(customer.outstanding)}</strong></div>
    <div class="span2 modal-actions"><button type="button" class="btn ghost" data-close-modal>Cancel</button><button class="btn primary" type="submit">Save payment</button></div>
  </form>`);
}

function codeModal(customer, code) {
  return modal("Pairing code", `<div class="notice">Give this code to the customer. It is entered only in the Nadeem Mobiles phone app.</div><div class="code-box"><div class="code">${esc(code)}</div><div class="muted" style="margin-top:8px">${esc(customer.name)}</div></div><div class="modal-actions" style="margin-top:16px"><button class="btn primary" data-close-modal>Done</button></div>`);
}

function detailsModal(c) {
  const deleteAllowed = !c.fcm_token && c.status !== "released";
  return modal(`Customer details — ${esc(c.name)}`, `<div class="detail-grid">
    <div class="detail-tile"><span>Phone</span><strong>${esc(c.phone_number)}</strong></div>
    <div class="detail-tile"><span>Status</span><strong>${statusBadge(c.status)}</strong></div>
    <div class="detail-tile"><span>Device</span><strong>${esc(c.device_model || "Not paired")}</strong></div>
    <div class="detail-tile"><span>Total</span><strong>${money(c.total_amount)}</strong></div>
    <div class="detail-tile"><span>Paid</span><strong>${money(c.paid_amount)}</strong></div>
    <div class="detail-tile"><span>Outstanding</span><strong>${money(c.outstanding)}</strong></div>
  </div>
  <div style="margin-top:14px" class="notice">Next due: <strong>${esc(c.next_due_date || "Not set")}</strong><br>Last seen: <strong>${fmtDate(c.last_seen)}</strong></div>
  <div style="margin-top:14px" class="note-box">${esc(c.notes || "No notes")}</div>
  <div class="modal-actions" style="margin-top:16px">
    <button class="btn ghost" data-close-modal>Close</button>
    <button class="btn" data-action="edit-customer" data-id="${c.id}">Edit</button>
    <button class="btn" data-action="payment" data-id="${c.id}">Payment</button>
    ${c.status === "pending" ? `<button class="btn" data-action="code" data-id="${c.id}">Pairing code</button>` : ""}
    ${c.status === "unlocked" ? `<button class="btn" data-action="lock" data-id="${c.id}">Lock</button>` : ""}
    ${c.status === "locked" ? `<button class="btn" data-action="unlock" data-id="${c.id}">Unlock</button>` : ""}
    ${["unlocked","locked"].includes(c.status) ? `<button class="btn" data-action="release" data-id="${c.id}">Release</button>` : ""}
    ${c.status === "released" ? `<button class="btn" data-action="reenroll" data-id="${c.id}">Re-enroll</button>` : ""}
    ${c.status === "pending" ? `<button class="btn danger" data-action="delete-customer" data-id="${c.id}">Delete</button>` : ""}
    ${deleteAllowed ? `<button class="btn danger" data-action="delete-customer" data-id="${c.id}">Delete</button>` : ""}
  </div>`);
}

async function createOrUpdateCustomer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = $("fName").value.trim();
  const phone = $("fPhone").value.trim();
  if (!name || !phone) return toast("Customer name and phone number are required.", "bad");
  const body = JSON.stringify({
    name, phoneNumber: phone, totalAmount: $("fTotal").value,
    installmentAmount: $("fInstallment").value, nextDueDate: $("fDue").value,
    notes: $("fNotes").value.trim()
  });
  try {
    if (form.dataset.id) {
      await api(`/api/customers/${form.dataset.id}`, {method:"PATCH", body});
      closeModal(); toast("Customer updated", "good"); await loadAll(); return;
    }
    const data = await api("/api/customers", {method:"POST", body});
    closeModal(); toast("Customer created", "good");
    openModal(codeModal({name}, data.pairingCode));
    await loadAll();
  } catch (err) { toast(err.message, "bad"); }
}

async function submitPayment(event) {
  event.preventDefault();
  const customerId = event.currentTarget.dataset.customerId;
  try {
    const data = await api(`/api/payments/customer/${customerId}`, {method:"POST", body:JSON.stringify({amount:$("pAmount").value,reference:$("pRef").value.trim(),note:$("pNote").value.trim()})});
    closeModal(); toast(`Payment saved: ${money(data.customer?.paid_amount) } total paid`, "good"); await loadAll();
  } catch (err) { toast(err.message, "bad"); }
}

async function deviceAction(id, action) {
  const c = state.customers.find((x) => Number(x.id) === Number(id));
  if (!c) return;
  const label = action === "lock" ? "Lock" : "Unlock";
  if (!confirm(`${label} ${c.name}'s device?`)) return;
  try { await api(`/api/customers/${id}/${action}`, {method:"POST", body: action === "lock" ? JSON.stringify({}) : undefined}); toast(`${label} command sent`, "good"); await loadAll(); }
  catch (err) { toast(err.message, "bad"); }
}

async function releaseDevice(id) {
  const c = state.customers.find((x) => Number(x.id) === Number(id));
  if (!c) return;
  if (!confirm(`Release ${c.name}?\n\nThe phone must acknowledge the release before it becomes removable.`)) return;
  try { await api(`/api/customers/${id}/release`, {method:"POST"}); toast("Release request sent", "good"); await loadAll(); }
  catch (err) { toast(err.message, "bad"); }
}

async function reEnroll(id) {
  const c = state.customers.find((x) => Number(x.id) === Number(id));
  if (!c) return;
  if (!confirm(`Create a fresh 6-digit pairing code for ${c.name}?`)) return;
  try { const data = await api(`/api/customers/${id}/re-enroll`, {method:"POST"}); toast("New enrollment created", "good"); await loadAll(); const fresh = state.customers.find((x) => Number(x.id) === Number(id)); if (fresh) openModal(codeModal(fresh, data.pairingCode)); }
  catch (err) { toast(err.message, "bad"); }
}

async function regenerateCode(id) {
  const c = state.customers.find((x) => Number(x.id) === Number(id));
  if (!c) return;
  if (!confirm(`Generate a new pairing code for ${c.name}? The old code will stop being valid.`)) return;
  try { const data = await api(`/api/customers/${id}/regenerate-code`, {method:"POST"}); toast("New pairing code generated", "good"); await loadAll(); const fresh = state.customers.find((x) => Number(x.id) === Number(id)); if (fresh) openModal(codeModal(fresh, data.pairingCode)); }
  catch (err) { toast(err.message, "bad"); }
}

async function removeCustomer(id) {
  const c = state.customers.find((x) => Number(x.id) === Number(id));
  if (!c) return;
  if (!confirm(`Delete ${c.name}?\n\nThis deletes the customer and related payment/event records. Enrolled devices must be released first.`)) return;
  try { await api(`/api/customers/${id}`, {method:"DELETE"}); closeModal(); toast("Customer deleted", "good"); await loadAll(); }
  catch (err) { toast(err.message, "bad"); }
}

async function deletePayment(id) {
  if (!confirm("Delete this payment record? The customer's paid total will be recalculated.")) return;
  try { await api(`/api/payments/${id}`, {method:"DELETE"}); toast("Payment deleted", "good"); await loadAll(); }
  catch (err) { toast(err.message, "bad"); }
}

async function healthCheck() {
  try { const d = await api("/api/health"); setConnection(true, "Backend connected"); toast(`${d.service} is online`, "good"); }
  catch (err) { setConnection(false, "Backend unavailable"); toast(err.message, "bad"); }
}

function bindContentEvents() {
  const content = $("content");
  content.querySelectorAll("[data-view]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); setView(el.dataset.view); }));
  const search = $("customerSearch");
  if (search) search.addEventListener("input", (e) => { state.customerSearch = e.target.value; const pos = e.target.selectionStart; render(); const next = $("customerSearch"); if (next) { next.focus(); next.setSelectionRange(pos, pos); } });
  const pf = $("paymentCustomerFilter");
  if (pf) pf.addEventListener("change", (e) => { state.paymentCustomerFilter = e.target.value; render(); });
}

$("content").addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const id = target.dataset.id;
  event.preventDefault();
  if (action === "new-customer") return openModal(customerForm());
  if (action === "details") { const c = state.customers.find((x) => Number(x.id) === Number(id)); if (c) openModal(detailsModal(c)); return; }
  if (action === "edit-customer") { const c = state.customers.find((x) => Number(x.id) === Number(id)); if (c) openModal(customerForm(c)); return; }
  if (action === "payment") { const c = state.customers.find((x) => Number(x.id) === Number(id)); if (c) openModal(paymentModal(c)); return; }
  if (action === "record-payment") { if (!state.customers.length) return toast("Create a customer first.", "bad"); openModal(paymentModal(state.customers[0])); return; }
  if (action === "code") { const c = state.customers.find((x) => Number(x.id) === Number(id)); if (c) openModal(codeModal(c, c.pairing_code)); return; }
  if (action === "regenerate") return regenerateCode(id);
  if (action === "reenroll") return reEnroll(id);
  if (action === "lock" || action === "unlock") { closeModal(); return deviceAction(id, action); }
  if (action === "release") { closeModal(); return releaseDevice(id); }
  if (action === "delete-customer") return removeCustomer(id);
  if (action === "delete-payment") return deletePayment(id);
  if (action === "health-check") return healthCheck();
});

$("modalHost").addEventListener("click", (event) => {
  if (event.target.matches("[data-modal-backdrop]")) return closeModal();
  const btn = event.target.closest("[data-close-modal]");
  if (btn) { event.preventDefault(); closeModal(); }
});

$("modalHost").addEventListener("submit", (event) => {
  if (event.target.id === "customerForm") return createOrUpdateCustomer(event);
  if (event.target.id === "paymentForm") return submitPayment(event);
});

document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });

function logout(showToast = true) {
  state.token = null;
  localStorage.removeItem("nm_token");
  localStorage.removeItem("nm_shop_name");
  $("appView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  if (showToast) toast("Signed out");
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("loginError").textContent = "";
  try {
    const data = await api("/api/login", {method:"POST", body:JSON.stringify({username:$("loginUsername").value.trim(), password:$("loginPassword").value})});
    state.token = data.token;
    state.shopName = data.shopName || "Nadeem Mobiles";
    localStorage.setItem("nm_token", state.token);
    localStorage.setItem("nm_shop_name", state.shopName);
    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    await loadAll();
  } catch (err) { $("loginError").textContent = err.message; }
});

$("logoutBtn").addEventListener("click", () => logout(true));
$("refreshBtn").addEventListener("click", loadAll);
$("addCustomerBtn").addEventListener("click", () => openModal(customerForm()));
$("nav").addEventListener("click", (event) => { const btn = event.target.closest("[data-view]"); if (btn) setView(btn.dataset.view); });

if (state.token) {
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  setConnection(false, "Checking backend…");
  loadAll();
} else {
  $("connectionDot").classList.remove("ok", "bad");
}
