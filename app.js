import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabasePublishableKey ? createClient(supabaseUrl, supabasePublishableKey) : null;
let authMode = "signin";
let dashboardInitialized = false;
const isPasswordRecovery = () => new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

const STORAGE_KEY = "debsn-prototype-v1";
const TODAY = "2026-10-27";
const statusMeta = {
  needs_review: { label: "Needs review", className: "needs-review" },
  ready: { label: "Ready to schedule", className: "ready" },
  assigned: { label: "Assigned", className: "assigned" },
  en_route: { label: "En route", className: "en-route" },
  arrived: { label: "Arrived", className: "arrived" },
  completed: { label: "Completed", className: "completed" },
  unsuccessful: { label: "Unsuccessful", className: "unsuccessful" },
};

const starterState = {
  orders: [
    { id: "DB-1042", customer: "Sarah Williams", phone: "(555) 018-4290", address: "1248 Maple Avenue, Newark, NJ", store: "Northline Home", appliance: "French door refrigerator", deliveryDate: TODAY, driverId: "drv-1", status: "arrived", instructions: "Install water line. Side entrance is clear.", arrivalTime: "10:42 AM", demo: true },
    { id: "DB-1041", customer: "Marcus Chen", phone: "(555) 018-1372", address: "83 Grove Street, Montclair, NJ", store: "Hearth & Home", appliance: "Washer and dryer set", deliveryDate: TODAY, driverId: "drv-2", status: "en_route", instructions: "Call customer 30 minutes before arrival.", arrivalTime: null, demo: true },
    { id: "DB-1040", customer: "Elena Rodriguez", phone: "(555) 018-3308", address: "7 Park Place, Bloomfield, NJ", store: "Northline Home", appliance: "Gas range", deliveryDate: TODAY, driverId: "drv-1", status: "assigned", instructions: "Confirm gas hookup before installation.", arrivalTime: null, demo: true },
    { id: "DB-1039", customer: "James Thompson", phone: "(555) 018-9021", address: "220 Oak Lane, Verona, NJ", store: "Metro Appliance", appliance: "Dishwasher", deliveryDate: TODAY, driverId: "drv-2", status: "assigned", instructions: "Unit is in the rear loading bay.", arrivalTime: null, demo: true },
    { id: "DB-1038", customer: "Priya Patel", phone: "(555) 018-5744", address: "61 Summit Road, West Orange, NJ", store: "Hearth & Home", appliance: "Electric dryer", deliveryDate: TODAY, driverId: null, status: "ready", instructions: "Customer prefers morning delivery.", arrivalTime: null, demo: true },
    { id: "DB-1037", customer: "David Brooks", phone: "(555) 018-2260", address: "14 River Street, Belleville, NJ", store: "Metro Appliance", appliance: "Upright freezer", deliveryDate: TODAY, driverId: null, status: "needs_review", instructions: "Apartment number missing from store email.", arrivalTime: null, demo: true },
    { id: "DB-1036", customer: "Olivia Davis", phone: "(555) 018-4427", address: "9 Union Avenue, Nutley, NJ", store: "Northline Home", appliance: "Over-the-range microwave", deliveryDate: "2026-10-26", driverId: "drv-1", status: "completed", instructions: "Remove old unit.", arrivalTime: null, demo: true },
  ],
  drivers: [
    { id: "drv-1", name: "Michael Johnson", initials: "MJ", phone: "(555) 014-0233", status: "On route", color: "#e2eee5" },
    { id: "drv-2", name: "Andre Wilson", initials: "AW", phone: "(555) 014-0881", status: "On route", color: "#e9e8f4" },
    { id: "drv-3", name: "Luis Martinez", initials: "LM", phone: "(555) 014-0604", status: "Available", color: "#f2eadf" },
  ],
  notifications: [
    { id: "notice-1", orderId: "DB-1042", type: "arrival", text: "Michael Johnson arrived at Sarah Williams’ address.", detail: "1248 Maple Avenue, Newark, NJ", time: "10:42 AM", read: false, demo: true },
  ],
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(starterState);
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.orders) || !Array.isArray(parsed.drivers)) return structuredClone(starterState);
    return parsed;
  } catch {
    return structuredClone(starterState);
  }
}
let state = loadState();
let currentView = "overview";
let activeFilter = "all";
let searchQuery = "";

const el = (id) => document.getElementById(id);
const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const initials = (name) => name.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
const driverById = (id) => state.drivers.find((driver) => driver.id === id);
const formatDate = (date) => {
  if (!date) return "Not scheduled";
  const parsed = new Date(`${date}T12:00:00`);
  if (date === TODAY) return "Today, Oct 27";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const toast = (message) => {
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  el("toast-region").append(item);
  window.setTimeout(() => item.remove(), 3100);
};

function renderStatus(status) {
  const meta = statusMeta[status] || statusMeta.ready;
  return `<span class="status-pill status-${meta.className}">${meta.label}</span>`;
}

function renderMetrics() {
  const todayOrders = state.orders.filter((order) => order.deliveryDate === TODAY);
  const metrics = [
    { label: "Needs review", value: todayOrders.filter((order) => order.status === "needs_review").length, icon: "!", foot: "Orders to look over" },
    { label: "Scheduled today", value: todayOrders.filter((order) => ["assigned", "en_route", "arrived"].includes(order.status)).length, icon: "▦", foot: "Assigned across your team" },
    { label: "In progress", value: todayOrders.filter((order) => ["en_route", "arrived"].includes(order.status)).length, icon: "⌁", foot: "En route or at the door" },
    { label: "Completed today", value: todayOrders.filter((order) => order.status === "completed").length, icon: "✓", foot: "Proof ready to review" },
  ];
  el("metric-grid").innerHTML = metrics.map((metric) => `<article class="metric-card"><div class="metric-top"><span class="metric-label">${metric.label}</span><span class="metric-icon">${metric.icon}</span></div><div class="metric-value">${metric.value}</div><div class="metric-foot">${metric.foot}</div></article>`).join("");
  el("nav-order-count").textContent = state.orders.filter((order) => order.status === "needs_review").length;
}

function visibleOrders() {
  const query = searchQuery.trim().toLowerCase();
  return [...state.orders]
    .filter((order) => activeFilter === "all" || order.status === activeFilter)
    .filter((order) => !query || [order.id, order.customer, order.address, order.store, order.appliance, driverById(order.driverId)?.name].join(" ").toLowerCase().includes(query))
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.id.localeCompare(a.id));
}

function orderRow(order) {
  const driver = driverById(order.driverId);
  return `<tr data-order-id="${escapeHTML(order.id)}" tabindex="0" aria-label="Open order ${escapeHTML(order.id)}"><td><span class="order-code">${escapeHTML(order.id)}</span></td><td><div class="customer-cell"><span class="customer-avatar">${initials(order.customer)}</span><span><span class="customer-name">${escapeHTML(order.customer)}</span><span class="customer-address">${escapeHTML(order.address)}</span></span></div></td><td><span class="date-cell">${formatDate(order.deliveryDate)}</span></td><td>${driver ? `<span class="driver-cell"><span class="driver-avatar" style="background:${driver.color}">${driver.initials}</span><span class="driver-name">${escapeHTML(driver.name.split(" ")[0])}</span></span>` : `<span class="unassigned">Unassigned</span>`}</td><td>${renderStatus(order.status)}</td><td><button class="row-more" aria-label="More options for ${escapeHTML(order.id)}">···</button></td></tr>`;
}

function renderOrders(limit = 5) {
  const matches = visibleOrders();
  const items = matches.slice(0, limit);
  el("orders-table-body").innerHTML = items.map(orderRow).join("");
  el("orders-empty").hidden = items.length > 0;
  el("orders-table-body").closest("table").hidden = items.length === 0;
  const countLabel = el("orders-count-label");
  if (countLabel) countLabel.textContent = `${matches.length} ${matches.length === 1 ? "order" : "orders"} in your workspace`;
  const range = el("table-range");
  if (range) range.textContent = `Showing ${items.length ? 1 : 0}–${items.length} of ${matches.length} orders`;
}

function renderArrivals() {
  const latest = [...state.notifications].filter((notice) => notice.type === "arrival").sort((a, b) => b.id.localeCompare(a.id)).slice(0, 3);
  el("arrival-list").innerHTML = latest.length ? latest.map((notice) => {
    const order = state.orders.find((item) => item.id === notice.orderId);
    const driver = order && driverById(order.driverId);
    return `<button class="arrival-item" data-order-id="${escapeHTML(notice.orderId)}"><span class="arrival-symbol">↗</span><span class="arrival-copy"><strong>${escapeHTML(driver?.name || "Driver")} arrived</strong><p>${escapeHTML(order?.customer || "Customer")} · ${escapeHTML(order?.address || notice.detail)}</p></span><span class="arrival-time">${escapeHTML(notice.time)}</span></button>`;
  }).join("") : `<div class="empty-state arrival-empty"><strong>No arrivals yet</strong><p>Driver arrival updates will appear here.</p></div>`;
  const unread = state.notifications.filter((notice) => !notice.read).length;
  el("notification-pip").hidden = unread === 0;
  el("activity-dot").hidden = unread === 0;
}

function renderRouteSummary() {
  const assigned = state.orders.filter((order) => order.deliveryDate === TODAY && order.driverId && ["assigned", "en_route", "arrived"].includes(order.status));
  const drivers = [...new Set(assigned.map((order) => order.driverId))].map(driverById).filter(Boolean);
  el("route-count").innerHTML = `${drivers.length} <span>active ${drivers.length === 1 ? "route" : "routes"}</span>`;
  el("route-summary").textContent = assigned.length ? `${assigned.length} assigned stops · order not optimized` : "No routes scheduled yet";
  el("route-avatars").innerHTML = drivers.slice(0, 3).map((driver) => `<span class="driver-avatar" title="${escapeHTML(driver.name)}" style="background:${driver.color}">${driver.initials}</span>`).join("");
}

function renderOverview() {
  renderMetrics();
  renderOrders(5);
  renderArrivals();
  renderRouteSummary();
}

function renderOrdersView() {
  return `<div class="secondary-heading"><div><h2>All orders</h2><p>Review incoming jobs and keep every delivery moving.</p></div><button class="button button-primary" data-new-order><span class="plus">＋</span> New order</button></div><div class="secondary-card"><div class="table-toolbar" style="padding:0 0 13px;border:0"><label class="search-box"><span>⌕</span><input id="secondary-search" type="search" placeholder="Search orders..." value="${escapeHTML(searchQuery)}" /></label><select class="filter-button" id="secondary-filter" aria-label="Filter orders"><option value="all">All statuses</option>${Object.entries(statusMeta).map(([key, value]) => `<option value="${key}" ${key === activeFilter ? "selected" : ""}>${value.label}</option>`).join("")}</select></div><div class="table-scroll"><table class="secondary-table"><thead><tr><th>ORDER</th><th>CUSTOMER & ADDRESS</th><th>STORE</th><th>DATE</th><th>DRIVER</th><th>STATUS</th></tr></thead><tbody>${visibleOrders().map((order) => { const driver = driverById(order.driverId); return `<tr data-order-id="${escapeHTML(order.id)}" tabindex="0"><td><strong class="order-code">${escapeHTML(order.id)}</strong></td><td>${escapeHTML(order.customer)}<br><small>${escapeHTML(order.address)}</small></td><td>${escapeHTML(order.store || "—")}</td><td>${formatDate(order.deliveryDate)}</td><td>${escapeHTML(driver?.name || "Unassigned")}</td><td>${renderStatus(order.status)}</td></tr>`; }).join("")}</tbody></table></div></div>`;
}

function renderDispatchView() {
  const groups = state.drivers.map((driver) => ({ driver, orders: state.orders.filter((order) => order.driverId === driver.id && order.deliveryDate === TODAY && ["assigned", "en_route", "arrived"].includes(order.status)) })).filter((group) => group.orders.length);
  return `<div class="secondary-heading"><div><h2>Dispatch board</h2><p>See today’s assignments by driver. Stop order is illustrative until routing is connected.</p></div><button class="date-chip"><span>▦</span> Today <span class="chevron-small">⌄</span></button></div><div class="secondary-card"><h3>Today’s routes</h3><p>${groups.length} assigned ${groups.length === 1 ? "driver" : "drivers"} · ${groups.reduce((total, group) => total + group.orders.length, 0)} active stops</p>${groups.length ? groups.map(({ driver, orders }) => `<div class="dispatch-row"><div class="dispatch-driver"><span class="driver-avatar" style="background:${driver.color}">${driver.initials}</span><strong class="driver-name">${escapeHTML(driver.name)}</strong></div><div class="dispatch-stops">${orders.map((order, index) => `${index ? '<span class="stop-arrow">→</span>' : ""}<button class="stop-chip" data-order-id="${escapeHTML(order.id)}">${index + 1}. ${escapeHTML(order.customer.split(" ")[0])} · ${escapeHTML(order.id)}</button>`).join("")}</div><div class="dispatch-meta">${orders.length} ${orders.length === 1 ? "stop" : "stops"}<br><span>${orders.some((order) => order.status === "arrived") ? "Arrival reported" : "Route not optimized"}</span></div></div>`).join("") : `<div class="empty-state"><span class="empty-icon">⌁</span><strong>No routes scheduled</strong><p>Assign a driver to a delivery to see it here.</p></div>`}</div><div class="report-note"><strong>Routing setup needed.</strong> This prototype does not calculate road distances, travel times, or optimized stop sequences. Connect a routing provider before using it for dispatch.</div>`;
}

function renderDriversView() {
  return `<div class="secondary-heading"><div><h2>Your drivers</h2><p>Driver access and today’s assignments.</p></div><button class="button button-secondary" id="add-driver-button">＋ Add driver</button></div><div class="driver-grid">${state.drivers.map((driver) => { const assigned = state.orders.filter((order) => order.driverId === driver.id && order.deliveryDate === TODAY && ["assigned", "en_route", "arrived"].includes(order.status)); return `<article class="secondary-card driver-card"><span class="customer-avatar" style="background:${driver.color}">${driver.initials}</span><span class="driver-card-copy"><strong>${escapeHTML(driver.name)}</strong><small>${escapeHTML(driver.phone)} · ${assigned.length} stops today</small></span><span class="driver-state">${escapeHTML(driver.status)}</span></article>`; }).join("")}</div><div class="report-note"><strong>Account setup is a next step.</strong> This prototype lists sample drivers only; secure driver sign-in and job-level permissions still need to be connected.</div>`;
}

function renderActivityView() {
  const notices = [...state.notifications].sort((a, b) => b.id.localeCompare(a.id));
  return `<div class="secondary-heading"><div><h2>Activity</h2><p>Delivery status events and owner alerts.</p></div><button class="button button-secondary" id="mark-read-button">Mark all as read</button></div><div class="secondary-card"><h3>Recent activity</h3><p>Saved notifications remain available in your activity history.</p>${notices.length ? notices.map((notice) => { const order = state.orders.find((item) => item.id === notice.orderId); const driver = order && driverById(order.driverId); return `<div class="activity-row" data-order-id="${escapeHTML(notice.orderId)}"><span class="arrival-symbol">↗</span><span><strong>${escapeHTML(driver?.name || "Driver")} arrived at ${escapeHTML(order?.customer || "customer location")}</strong><p>${escapeHTML(order?.address || notice.detail)} · ${escapeHTML(order?.id || notice.orderId)}${notice.read ? " · Read" : " · Unread"}</p></span><time>${escapeHTML(notice.time)}</time></div>`; }).join("") : `<div class="empty-state"><strong>No activity yet</strong><p>Status changes will appear here.</p></div>`}</div>`;
}

function renderReportsView() {
  const todayOrders = state.orders.filter((order) => order.deliveryDate === TODAY);
  const completed = todayOrders.filter((order) => order.status === "completed").length;
  const open = todayOrders.filter((order) => !["completed", "unsuccessful"].includes(order.status)).length;
  const arrived = state.notifications.filter((notice) => notice.type === "arrival").length;
  return `<div class="secondary-heading"><div><h2>Daily report</h2><p>Operational snapshot for Tuesday, October 27, 2026.</p></div><button class="button button-secondary" id="export-report-button">Export report</button></div><div class="secondary-card"><h3>Delivery performance</h3><p>Sample data snapshot · not a production report</p><div class="report-grid"><div class="report-tile"><span>Orders scheduled</span><strong>${todayOrders.length}</strong></div><div class="report-tile"><span>Completed</span><strong>${completed}</strong></div><div class="report-tile"><span>Still open</span><strong>${open}</strong></div><div class="report-tile"><span>Arrival updates</span><strong>${arrived}</strong></div><div class="report-tile"><span>Drivers assigned</span><strong>${new Set(todayOrders.filter((order) => order.driverId).map((order) => order.driverId)).size}</strong></div><div class="report-tile"><span>Needs review</span><strong>${todayOrders.filter((order) => order.status === "needs_review").length}</strong></div></div><div class="report-note">Proof-of-completion exports, verified mileage, customer notification delivery, and audit history are not connected in this prototype.</div></div>`;
}

const viewContent = { orders: renderOrdersView, dispatch: renderDispatchView, drivers: renderDriversView, activity: renderActivityView, reports: renderReportsView };
const viewTitles = { overview: "Overview", orders: "Orders", dispatch: "Dispatch", drivers: "Drivers", activity: "Activity", reports: "Reports" };

function setView(view) {
  currentView = viewTitles[view] ? view : "overview";
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === currentView));
  el("breadcrumb-current").textContent = viewTitles[currentView];
  el("overview-view").hidden = currentView !== "overview";
  el("secondary-view").hidden = currentView === "overview";
  el("page-title").textContent = currentView === "overview" ? "Good morning, Chantall" : viewTitles[currentView];
  el("page-overline").textContent = currentView === "overview" ? "TUESDAY, OCTOBER 27, 2026" : "DEBSN’S INC. · OPERATIONS";
  el("page-subtitle").textContent = currentView === "overview" ? "Here’s what’s happening with your deliveries today." : "A clear view of your delivery operation.";
  if (currentView !== "overview") el("secondary-content").innerHTML = viewContent[currentView]();
  history.replaceState(null, "", `#${currentView}`);
}

function openOrder(orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return;
  const driver = driverById(order.driverId);
  el("detail-content").innerHTML = `<div class="detail-title"><div><p class="overline">DELIVERY ORDER</p><h2>${escapeHTML(order.id)} <span>${renderStatus(order.status)}</span></h2><p>${escapeHTML(order.store || "Store not provided")}</p></div><button class="icon-button modal-close" data-close-detail aria-label="Close">×</button></div><div class="detail-grid"><div class="detail-item"><span>CUSTOMER</span><strong>${escapeHTML(order.customer)}</strong></div><div class="detail-item"><span>PHONE</span><strong>${escapeHTML(order.phone || "Not provided")}</strong></div><div class="detail-item"><span>DELIVERY DATE</span><strong>${formatDate(order.deliveryDate)}</strong></div><div class="detail-item"><span>DRIVER</span><strong>${escapeHTML(driver?.name || "Unassigned")}</strong></div><div class="detail-item" style="grid-column:1/-1"><span>DELIVERY ADDRESS</span><strong>${escapeHTML(order.address)}</strong></div><div class="detail-item" style="grid-column:1/-1"><span>APPLIANCE</span><strong>${escapeHTML(order.appliance || "Not specified")}</strong></div></div><div class="detail-block"><h3>DELIVERY INSTRUCTIONS</h3><p>${escapeHTML(order.instructions || "No instructions provided.")}</p></div>${order.arrivalTime ? `<div class="detail-block"><h3>ARRIVAL</h3><p>Sample arrival recorded at ${escapeHTML(order.arrivalTime)}. This prototype record is not connected to a driver account.</p></div>` : ""}<div class="detail-actions"><button class="button button-secondary" data-close-detail>Close</button><button class="button button-primary" data-edit-status="${escapeHTML(order.id)}">Update status <span>→</span></button></div>`;
  el("detail-modal").showModal();
}

function createOrder(formData) {
  const order = {
    id: `DB-${Math.max(1042, ...state.orders.map((item) => Number(item.id.replace("DB-", "")) || 0)) + 1}`,
    customer: String(formData.get("customer") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    store: String(formData.get("store") || "").trim(),
    appliance: String(formData.get("appliance") || "").trim(),
    deliveryDate: String(formData.get("date") || TODAY),
    driverId: null,
    status: "ready",
    instructions: String(formData.get("instructions") || "").trim(),
    arrivalTime: null,
    demo: true,
  };
  state.orders.unshift(order);
  saveState();
  renderOverview();
  if (currentView === "orders") setView("orders");
  toast(`${order.id} added to the sample workspace`);
}

function setFilter(filter) {
  activeFilter = filter;
  el("status-filter-label").textContent = filter === "all" ? "All statuses" : statusMeta[filter]?.label || "All statuses";
  el("status-filter-menu").hidden = true;
  renderOrders(5);
}

function attachEvents() {
  document.addEventListener("click", (event) => {
    const navLink = event.target.closest("[data-view]");
    if (navLink) { event.preventDefault(); setView(navLink.dataset.view); el("sidebar").classList.remove("open"); return; }
    const viewLink = event.target.closest("[data-view-link]");
    if (viewLink) { setView(viewLink.dataset.viewLink); return; }
    const row = event.target.closest("[data-order-id]");
    if (row) { openOrder(row.dataset.orderId); return; }
    if (event.target.closest("[data-new-order]") || event.target.closest("#new-order-button")) { el("order-modal").showModal(); return; }
    if (event.target.closest("#status-filter-button")) { el("status-filter-menu").hidden = !el("status-filter-menu").hidden; return; }
    const filterOption = event.target.closest("[data-filter]");
    if (filterOption) { setFilter(filterOption.dataset.filter); return; }
    if (event.target.closest("#clear-filters")) { searchQuery = ""; activeFilter = "all"; el("order-search").value = ""; setFilter("all"); renderOrders(5); return; }
    if (event.target.closest("#notification-button")) { setView("activity"); return; }
    if (event.target.closest("#mobile-menu")) { el("sidebar").classList.toggle("open"); return; }
    if (event.target.closest("[data-close-detail]")) { el("detail-modal").close(); return; }
    if (event.target.closest("#mark-read-button")) { state.notifications.forEach((notice) => { notice.read = true; }); saveState(); setView("activity"); renderArrivals(); toast("Notifications marked as read"); return; }
    if (event.target.closest("#help-button")) { toast("Help center will be connected in a later build phase"); return; }
    if (event.target.closest("#profile-button")) { supabase?.auth.signOut(); return; }
    if (event.target.closest("#add-driver-button")) { toast("Driver accounts will be added with secure authentication"); return; }
    if (event.target.closest("#export-report-button")) { toast("Report export is not connected in this prototype"); return; }
    if (event.target.id === "detail-modal") el("detail-modal").close();
    if (!event.target.closest(".filter-wrap")) el("status-filter-menu").hidden = true;
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); el("order-search").focus(); }
    if (event.key === "Enter" && event.target.matches("tr[data-order-id]")) openOrder(event.target.dataset.orderId);
  });

  el("order-search").addEventListener("input", (event) => { searchQuery = event.target.value; renderOrders(5); });
  document.addEventListener("input", (event) => {
    if (event.target.id !== "secondary-search") return;
    searchQuery = event.target.value;
    const body = event.target.closest(".secondary-card").querySelector("tbody");
    body.innerHTML = visibleOrders().map((order) => { const driver = driverById(order.driverId); return `<tr data-order-id="${escapeHTML(order.id)}" tabindex="0"><td><strong class="order-code">${escapeHTML(order.id)}</strong></td><td>${escapeHTML(order.customer)}<br><small>${escapeHTML(order.address)}</small></td><td>${escapeHTML(order.store || "—")}</td><td>${formatDate(order.deliveryDate)}</td><td>${escapeHTML(driver?.name || "Unassigned")}</td><td>${renderStatus(order.status)}</td></tr>`; }).join("");
  });
  document.addEventListener("change", (event) => {
    if (event.target.id !== "secondary-filter") return;
    activeFilter = event.target.value;
    const body = event.target.closest(".secondary-card").querySelector("tbody");
    body.innerHTML = visibleOrders().map((order) => { const driver = driverById(order.driverId); return `<tr data-order-id="${escapeHTML(order.id)}" tabindex="0"><td><strong class="order-code">${escapeHTML(order.id)}</strong></td><td>${escapeHTML(order.customer)}<br><small>${escapeHTML(order.address)}</small></td><td>${escapeHTML(order.store || "—")}</td><td>${formatDate(order.deliveryDate)}</td><td>${escapeHTML(driver?.name || "Unassigned")}</td><td>${renderStatus(order.status)}</td></tr>`; }).join("");
  });
  el("focus-search").addEventListener("click", () => { setView("overview"); el("order-search").focus(); });
  el("order-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    createOrder(new FormData(event.currentTarget));
    event.currentTarget.reset();
    el("order-modal").close();
  });
  el("detail-content").addEventListener("click", (event) => {
    const statusButton = event.target.closest("[data-edit-status]");
    if (!statusButton) return;
    const order = state.orders.find((item) => item.id === statusButton.dataset.editStatus);
    if (!order) return;
    const sequence = ["ready", "assigned", "en_route", "arrived", "completed"];
    const next = sequence[(sequence.indexOf(order.status) + 1) % sequence.length];
    order.status = next;
    if (next === "arrived" && !state.notifications.some((notice) => notice.orderId === order.id && notice.type === "arrival")) {
      order.arrivalTime = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      state.notifications.unshift({ id: `notice-${Date.now()}`, orderId: order.id, type: "arrival", text: `${driverById(order.driverId)?.name || "Driver"} arrived at ${order.customer}’s address.`, detail: order.address, time: order.arrivalTime, read: false, demo: true });
    }
    saveState();
    renderOverview();
    el("detail-modal").close();
    if (currentView !== "overview") setView(currentView);
    toast(`${order.id} updated in this sample workspace`);
  });
}

function initDashboard(user, profile) {
  el("app-shell").hidden = false;
  el("auth-screen").hidden = true;
  const name = profile.display_name || user.email?.split("@")[0] || "User";
  el("user-name").textContent = name;
  el("user-role").textContent = profile.role === "owner" ? "Owner" : profile.role === "driver" ? "Driver" : "Dispatcher";
  el("user-avatar").textContent = initials(name);
  if (dashboardInitialized) return;
  dashboardInitialized = true;
  el("today-label").textContent = "Tue, Oct 27";
  document.querySelectorAll("[data-view-link]").forEach((button) => button.addEventListener("keydown", (event) => { if (event.key === "Enter") setView(button.dataset.viewLink); }));
  renderOverview();
  const initialView = window.location.hash.slice(1);
  if (initialView && initialView !== "overview") setView(initialView);
  attachEvents();
}

function showAuth() {
  el("app-shell").hidden = true;
  el("auth-screen").hidden = false;
}

function showAuthNotice(message, isError = false) {
  const notice = el("auth-notice");
  notice.textContent = message;
  notice.classList.toggle("error", isError);
  notice.hidden = false;
}

async function openWorkspace(user) {
  if (!user) { showAuth(); return; }
  const { data, error } = await supabase.from("profiles").select("display_name, role, approval_status").eq("id", user.id).maybeSingle();
  if (error) {
    showAuth();
    showAuthNotice("Your account is signed in, but the Debsn profile database is not ready. Apply the Supabase migration from supabase/migrations, then try again.", true);
    return;
  }
  if (!data || data.approval_status === "suspended") {
    showAuth();
    showAuthNotice("This Debsn account is currently suspended. Contact your workspace administrator.", true);
    return;
  }
  initDashboard(user, data);
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  const recovery = mode === "recovery";
  el("auth-title").textContent = recovery ? "Set a new password" : signup ? "Create your account" : "Sign in to your workspace";
  el("auth-name-field").hidden = !signup;
  el("auth-name").required = signup;
  el("auth-password").autocomplete = signup || recovery ? "new-password" : "current-password";
  el("auth-password").value = "";
  el("auth-password").previousElementSibling.textContent = recovery ? "New password" : "Password";
  el("auth-submit").innerHTML = recovery ? "Update password <span>→</span>" : signup ? "Create account <span>→</span>" : "Sign in <span>→</span>";
  el("auth-mode-toggle").hidden = recovery;
  el("auth-mode-toggle").textContent = signup ? "Already have an account? Sign in" : "Create an account";
  el("auth-reset").hidden = signup || recovery;
  el("auth-notice").hidden = true;
}

async function startAuth() {
  if (!supabase) {
    showAuth();
    showAuthNotice("Supabase is not configured. Copy .env.example to .env.local, add the project URL and publishable key, then restart the dev server.", true);
    return;
  }
  showAuth();
  const { data: { session } } = await supabase.auth.getSession();
  if (isPasswordRecovery()) {
    setAuthMode("recovery");
    showAuthNotice("Choose a new password for your Debsn account.");
  } else {
    await openWorkspace(session?.user ?? null);
  }
  supabase.auth.onAuthStateChange((_event, nextSession) => {
    if (!isPasswordRecovery()) window.setTimeout(() => { void openWorkspace(nextSession?.user ?? null); }, 0);
  });

  el("auth-mode-toggle").addEventListener("click", () => setAuthMode(authMode === "signin" ? "signup" : "signin"));
  el("auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = el("auth-submit");
    button.disabled = true;
    el("auth-notice").hidden = true;
    const email = el("auth-email").value.trim();
    const password = el("auth-password").value;
    let error;
    try {
      if (authMode === "recovery") {
        const result = await supabase.auth.updateUser({ password });
        error = result.error;
        if (!error) {
          history.replaceState(null, "", window.location.pathname);
          showAuthNotice("Password updated. Signing you into Debsn…");
          await openWorkspace(result.data.user);
        }
      } else if (authMode === "signup") {
        const result = await supabase.auth.signUp({ email, password, options: { data: { display_name: el("auth-name").value.trim() }, emailRedirectTo: window.location.origin } });
        error = result.error;
        if (!error) {
          if (result.data.session) await openWorkspace(result.data.user);
          else showAuthNotice("Check your email for the confirmation link. After confirming, sign in here.");
        }
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        error = result.error;
        if (!error) await openWorkspace(result.data.user);
      }
      if (error) showAuthNotice(error.message, true);
    } catch (caught) {
      showAuthNotice(caught.message || "Authentication could not be completed.", true);
    } finally {
      button.disabled = false;
    }
  });
  el("auth-reset").addEventListener("click", async () => {
    const email = el("auth-email").value.trim();
    if (!email) { showAuthNotice("Enter your email address first, then choose Forgot password?", true); el("auth-email").focus(); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    showAuthNotice(error ? error.message : "If an account exists for that email, a password reset link is on its way.", Boolean(error));
  });
}

void startAuth();
