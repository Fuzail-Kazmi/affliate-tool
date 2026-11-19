"use strict";
const root = document.querySelector("#root");
const dialog = document.querySelector("#dialog");
const paths = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  store:
    "M3 10l2-6h14l2 6 M4 11v9h16v-9 M2 10q2 5 5 0 2 5 5 0 2 5 5 0 3 5 5 0 M9 20v-6h6v6",
  sheet: "M5 3h14v18H5z M5 9h14 M5 15h14 M10 9v12",
  people:
    "M16 20v-2q0-4-6-4t-6 4v2 M13 7a3 3 0 1 1-6 0 3 3 0 1 1 6 0 M17 5q5 2 1 6 M18 14q4 1 4 5",
  chart: "M3 20h18 M6 16v-5 M12 16V4 M18 16V8",
  log: "M3 12a9 9 0 1 0 3-7L3 8 M3 3v5h5 M12 7v6l4 2",
  exit: "M10 4H4v16h6 M9 12h12 M17 8l4 4-4 4",
  plus: "M12 5v14 M5 12h14",
  check: "m5 12 4 4L19 6",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0 M12 7v6l4 2",
  scan: "M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M6 12h12",
  list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.1 M3 12h.1 M3 18h.1",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 1 1 12 0 M15 15l6 6",
  close: "m6 6 12 12 M18 6 6 18",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  cal: "M4 6h16v15H4z M8 3v6 M16 3v6 M4 11h16",
  link: "m9 15 6-6 M8 10l-3 3a4 4 0 0 0 6 6l3-3 M16 14l3-3a4 4 0 0 0-6-6l-3 3",
  lock: "M5 10h14v11H5z M8 10V7a4 4 0 1 1 8 0v3",
  layers: "m3 8 9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5",
  pulse: "M2 12h5l3-8 4 16 3-8h5",
  folder: "M3 6h7l2 3h9v11H3z",
  external: "M13 4h7v7 M20 4 10 14 M10 5H4v15h15v-6",
};
const icon = (name, size = 19) =>
  `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.grid}"/></svg>`;
const logo = () =>
  `<span class="brandmark" aria-hidden="true"><i></i><i></i><i></i></span><b>Fieldwork</b>`;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const initials = (name) =>
  (name || "—")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
const avatar = (name, id = 0) =>
  `<span class="avatar tone${Number(id) % 5}">${esc(initials(name))}</span>`;
const action = (id, label, style = "secondary", symbol = "") =>
  `<button type="button" class="${style}" data-act="${esc(id)}">${symbol ? icon(symbol, 16) : ""}${esc(label)}</button>`;
const shortTime = (t) =>
  new Date(t * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
const dateText = (s, opts = { month: "short", day: "numeric" }) =>
  new Date(s + "T12:00:00").toLocaleDateString(undefined, opts);
const elapsed = (seconds) =>
  `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
const input = (label, key, value = "", type = "text", extra = "") =>
  `<label>${label}<input name="${key}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const select = (label, key, options, selected) =>
  `<label>${label}<select name="${key}">${options.map(([val, title]) => `<option value="${esc(val)}" ${String(val) === String(selected ?? "") ? "selected" : ""}>${esc(title)}</option>`).join("")}</select></label>`;
const note = (message) => `<p class="hint">${esc(message)}</p>`;
const empty = (text) =>
  `<div class="empty">${icon("folder", 24)}<span>${esc(text)}</span></div>`;
let state,
  csrf = "",
  page = "Overview",
  scope = "All",
  search = "",
  toastTimeout,
  reportDay = "",
  auditPages = [],
  permissionData,
  refreshStamp = 0;
let visitedStore = null,
  discoveryDraft = null,
  busy = false;
const can = (p) => state?.me.permissions.includes(p);
const person = (id) =>
  state.people.find((p) => p.id === id)?.name || "Unassigned";
const timer = (s) => state.timers.find((t) => t.store === s.id);
const status = (s) => (timer(s) ? "In progress" : s.status);
const chip = (s) =>
  `<span class="chip ${s === "Done" ? "done" : s === "In progress" ? "working" : "pending"}"><i></i>${esc(s)}</span>`;
const own = (s) => s.person === state.me.id;
const writable = (s) =>
  own(s) || state.me.role === "Admin" || can("assign.write");
const employees = () => [
  ["", "Unassigned"],
  ...state.people.filter((p) => p.active).map((p) => [p.id, p.name]),
];
const sheetOptions = () => [
  ["", "No sheet"],
  ...state.sheets.map((s) => [s.id, s.name]),
];
const parseId = (value) => (value ? Number(value) : null);
async function api(path, data) {
  const res = await fetch(
    "/api/" + path,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          body: JSON.stringify(data),
        },
  );
  const result = await res.json();
  if (!res.ok) {
    if (res.status === 401 && state) {
      state = null;
      dialog.close();
      auth(false);
    }
    throw Error(result.error || "Request failed.");
  }
  return result;
}
function toast(message) {
  const t = document.querySelector("#toast");
  t.textContent = message;
  t.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove("visible"), 4000);
}
function showError(e) {
  const target = dialog.open
    ? dialog.querySelector(".error")
    : document.querySelector(".error");
  if (target) {
    target.textContent = e.message;
    target.hidden = false;
  } else toast(e.message);
}
function modal(title, contents, eyebrow = "") {
  dialog.innerHTML = `<div class="modal-head"><div>${eyebrow ? `<div class="kicker">${esc(eyebrow)}</div>` : ""}<h2>${esc(title)}</h2></div><button class="iconbtn" data-act="close" aria-label="Close">${icon("close")}</button></div><div class="modal-body"><div class="error" role="alert" hidden></div>${contents}</div>`;
  if (!dialog.open) dialog.showModal();
}
function auth(setup) {
  const title = setup ? "Create your workspace" : "Welcome back";
  root.innerHTML = `<main class="auth"><section class="auth-left"><div class="brand">${logo()}</div><div class="auth-form"><div class="kicker">AFFILIATE OPERATIONS</div><h1>${title}</h1><p>${setup ? "Set up your administrator account to manage stores, offers, and your team." : "Sign in to your affiliate workspace."}</p><form id="auth" data-setup="${setup}"><div class="error" role="alert" hidden></div>${setup ? input("Full name", "name", "", "text", "required maxlength=80 autocomplete=name") : ""}${input("Email address", "email", "", "email", "required autocomplete=username")}${input("Password", "password", "", "password", setup ? "required minlength=10 maxlength=256 autocomplete=new-password placeholder='At least 10 characters'" : "required autocomplete=current-password")}${setup ? `<label class="checkline"><input name="sample" type="checkbox">Include sample stores and employees</label>` : ""}<button class="primary">${setup ? "Create workspace" : "Sign in"}</button></form></div><small>Fieldwork / Workspace access</small></section><aside class="auth-art"><div class="art-grid"></div><div class="art-content"><span class="art-icon">${icon("layers", 38)}</span><h2>Affiliate<br><em>operations.</em></h2><div class="art-rule"></div><div class="minirow">${icon("store")} Store management</div><div class="minirow">${icon("people")} Team performance</div><div class="minirow">${icon("scan")} Offer discovery</div></div></aside></main>`;
}
function navItems() {
  return [
    ["Overview", "grid", true],
    ["Stores", "store", can("stores.read")],
    ["Sheets", "sheet", can("sheets.read") || can("assign.write")],
    ["Performance", "chart", can("reports.read") || can("team.read")],
    ["Activity log", "log", can("audit.read")],
    ["Team & access", "people", state.me.role === "Admin"],
  ].filter((n) => n[2]);
}
function frame(body) {
  const nav = navItems();
  root.innerHTML = `<div class="layout"><aside class="sidebar"><div class="brand">${logo()}</div><div class="workspace-id"><span class="workspace-logo">${icon("layers")}</span><div><b>Affiliate workspace</b><small>Operations panel</small></div></div><div class="nav-group">WORKSPACE</div><nav>${nav.map(([name, symbol]) => `<button class="nav ${name === page ? "active" : ""}" data-page="${esc(name)}" ${name === page ? 'aria-current="page"' : ""}>${icon(symbol)}${esc(name)}${name === "Stores" ? `<span class="navcount">${state.stores.length}</span>` : ""}</button>`).join("")}</nav><div class="profile">${avatar(state.me.name, state.me.id)}<div><b>${esc(state.me.name)}</b><small>${esc(state.me.role)}</small></div><button class="iconbtn" data-act="logout" aria-label="Sign out" title="Sign out">${icon("exit", 17)}</button></div></aside><div class="stage"><header class="topbar"><div><button class="iconbtn mobile" aria-label="Toggle navigation" data-act="menu">${icon("menu")}</button><span>Workspace</span><span class="slash">/</span><strong>${esc(page)}</strong></div><div class="date">${icon("cal", 16)}${dateText(state.today, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div></header><main class="content">${body}</main></div></div>`;
}
const heading = (title, subtitle, buttons = "") =>
  `<div class="pagehead"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="actions">${buttons}</div></div>`;
function stats() {
  const stores = state.stores,
    done = stores.filter((s) => s.status === "Done").length;
  const cards = [
    ["Total stores", stores.length, "store", "sage"],
    ["Pending stores", stores.length - done, "clock", "sand"],
    ["Completed stores", done, "check", "blue"],
    ["Work in progress", state.timers.length, "pulse", "lilac"],
  ];
  return `<div class="stats">${cards.map(([title, value, symbol, color]) => `<div class="stat"><div class="statline"><span class="stat-icon ${color}">${icon(symbol, 19)}</span><span>${title}</span></div><strong>${value}</strong></div>`).join("")}</div>`;
}
function chart() {
  const week = state.week,
    peak = Math.max(2, ...week.flatMap((d) => [d.Add || 0, d.Update || 0]));
  const max = Math.ceil(peak / 2) * 2;
  return `<section class="panel productivity"><div class="panelhead"><div><h2>Store activity</h2><p>Stores added and updated over the last 7 days</p></div>${icon("chart", 20)}</div><div class="plot"><div class="axis"><span>${max}</span><span>${max / 2}</span><span>0</span></div><div class="bars">${week.map((d) => `<div class="barcol" title="${d.date} · ${d.Add || 0} added, ${d.Update || 0} updated"><div class="barpair"><b style="height:${(100 * (d.Add || 0)) / max}%"></b><i style="height:${(100 * (d.Update || 0)) / max}%"></i></div><small>${dateText(d.date, { weekday: "short" })}</small></div>`).join("")}</div></div><div class="legend"><span><i></i>Stores added</span><span><i></i>Stores updated</span></div></section>`;
}
function workload() {
  const counts = state.people
    .map((p) => ({
      ...p,
      count: state.stores.filter(
        (s) => s.person === p.id && s.status !== "Done",
      ).length,
    }))
    .filter((p) => p.active)
    .sort((a, b) => b.count - a.count);
  return `<section class="panel workload"><div class="panelhead"><div><h2>Team workload</h2><p>Open assignments by employee</p></div>${icon("people", 20)}</div><div class="worklist">${
    counts
      .slice(0, 4)
      .map(
        (p) =>
          `<div class="workrow">${avatar(p.name, p.id)}<div><b>${esc(p.name)}</b><small>${esc(p.role)}</small></div><span>${p.count} open</span></div>`,
      )
      .join("") || empty("No employees yet.")
  }</div></section>`;
}
function storeTable(items) {
  if (!items.length) return empty("No stores match this view.");
  return `<div class="tablewrap"><table><thead><tr><th>Store name</th><th>Assigned to</th><th>Task</th><th>Status</th><th><span class="sr">Details</span></th></tr></thead><tbody>${items.map((s) => `<tr><td><button class="storecell" data-act="store/${s.id}"><span class="storemark tone${s.id % 5}">${esc(initials(s.name))}</span><span><b>${esc(s.name)}</b><small>${esc(s.category || "Uncategorized")}</small></span></button></td><td>${esc(person(s.person))}</td><td>${esc(s.kind)} store</td><td>${chip(status(s))}</td><td><button class="rowopen" data-act="store/${s.id}" aria-label="Open ${esc(s.name)}">›</button></td></tr>`).join("")}</tbody></table></div>`;
}
function overview() {
  const add =
    can("stores.add") && can("stores.read")
      ? action("newStore", "Add store", "primary", "plus")
      : "";
  return (
    heading(
      "Workspace overview",
      state.me.role === "Store Adder"
        ? "Your assigned stores and daily progress."
        : "A live view of store operations and team progress.",
      add,
    ) +
    stats() +
    `<div class="twocol">${chart()}${workload()}</div>` +
    (can("stores.read")
      ? `<section class="panel"><div class="panelhead"><div><h2>Store queue</h2><p>Open assignments, followed by completed work</p></div>${action("allStores", "View all stores", "textbtn")}</div>${storeTable([...state.stores].sort((a, b) => (a.status === "Done") - (b.status === "Done")).slice(0, 5))}</section>`
      : "") +
    `<section class="panel"><div class="panelhead"><h2>Recent activity</h2></div>${activities(state.activity)}</section>`
  );
}
function activities(list) {
  return list.length
    ? `<div class="activity">${list.map((a) => `<div class="activity-row"><span class="event-icon">${icon("log", 16)}</span><div><b>${esc(a.action)}</b> · ${esc(a.target)}<small>${esc(a.name)} · ${esc(a.role)}</small></div><time>${esc(new Date(a.at * 1000).toLocaleDateString())} · ${shortTime(a.at)}</time></div>`).join("")}</div>`
    : empty("No activity for this period.");
}
function filtered() {
  return state.stores.filter(
    (s) =>
      (scope === "All" || status(s) === scope) &&
      (s.name + " " + s.category + " " + s.url + " " + person(s.person))
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
}
function storesPage() {
  return (
    heading(
      "Stores",
      "Manage store records, assignments, and offers.",
      can("stores.add")
        ? action("newStore", "Add store", "primary", "plus")
        : "",
    ) +
    `<section class="panel"><div class="filters"><div class="tabs">${["All", "Pending", "In progress", "Done"].map((t) => `<button data-filter="${t}" class="${scope === t ? "selected" : ""}">${t}</button>`).join("")}</div><label class="search">${icon("search", 16)}<input id="search" aria-label="Search stores" placeholder="Search stores" value="${esc(search)}"></label></div><div id="results">${storeTable(filtered())}</div></section>`
  );
}
function sheetsPage() {
  return (
    heading(
      "Sheets",
      "Open work sheets and manage their assignments.",
      can("assign.write")
        ? action("sheet/new", "Add sheet", "primary", "plus")
        : "",
    ) +
    `<section class="panel">${state.sheets.length ? `<div class="tablewrap"><table><thead><tr><th>Sheet</th><th>Assigned to</th><th>Linked stores</th><th></th></tr></thead><tbody>${state.sheets.map((s) => `<tr><td><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)} ${icon("external", 13)}</a></td><td>${esc(person(s.person))}</td><td>${state.stores.filter((i) => i.sheet === s.id).length}</td><td>${can("assign.write") ? action("sheet/" + s.id, "Edit", "textbtn") : ""}</td></tr>`).join("")}</tbody></table></div>` : empty("No sheets assigned yet.")}</section>`
  );
}
function reportsPage(r) {
  const detailed = can("reports.read");
  return (
    heading(
      "Employee performance",
      detailed
        ? "Daily totals, per-store working time, and task history."
        : "Today's employee workload and completions.",
      detailed
        ? input("Report date", "day", r.day, "date", 'id="reportDay"')
        : "",
    ) +
    `<section class="panel"><div class="panelhead"><h2>Daily performance</h2></div><div class="tablewrap"><table><thead><tr><th>Employee</th><th>Stores added</th><th>Stores updated</th><th>Working time</th></tr></thead><tbody>${r.people.map((p) => `<tr><td><b>${esc(p.name)}</b></td><td>${p.added}</td><td>${p.updated}</td><td>${elapsed(p.seconds)}</td></tr>`).join("")}</tbody></table></div></section>` +
    (detailed
      ? `<section class="panel"><div class="panelhead"><h2>Store breakdown</h2></div>${r.stores.length ? `<div class="tablewrap"><table><thead><tr><th>Employee</th><th>Store</th><th>Added / updated</th><th>Working time</th></tr></thead><tbody>${r.stores.map((s) => `<tr><td>${esc(r.people.find((p) => p.person === s.person)?.name)}</td><td>${esc(s.name)}</td><td>${s.added} / ${s.updated}</td><td>${elapsed(s.seconds)}</td></tr>`).join("")}</tbody></table></div>` : empty("No store work recorded on this date.")}</section><section class="panel"><div class="panelhead"><h2>Daily activity</h2></div>${activities(r.activity)}</section>`
      : "")
  );
}
function auditPage() {
  return (
    heading(
      "Activity log",
      "Review employee actions, permission changes, and previous values.",
    ) +
    `<section class="panel audit">${auditPages.map((a) => `<details><summary><span><b>${esc(a.action)}</b> · ${esc(a.target)}<small>${esc(a.name)} · ${esc(a.role)}</small></span><time>${esc(new Date(a.at * 1000).toLocaleString())}</time></summary><div class="diff">${["previous", "updated"].map((k) => `<div><b>${k === "previous" ? "Previous values" : "Updated values"}</b><pre>${esc(JSON.stringify(JSON.parse(a[k]), null, 2) ?? "—")}</pre></div>`).join("")}</div></details>`).join("") || empty("No activity recorded.")}${auditPages.length && auditPages.length % 100 === 0 ? action("older", "Load older activity", "secondary") : ""}</section>`
  );
}
function teamPage() {
  return (
    heading(
      "Team & access",
      "Manage employee accounts, roles, and individual permissions.",
      action("employee/new", "Add employee", "primary", "plus"),
    ) +
    `<section class="panel"><div class="tablewrap"><table><thead><tr><th>Employee</th><th>Role</th><th>Account</th><th></th></tr></thead><tbody>${permissionData.people.map((p) => `<tr><td><div class="personcell">${avatar(p.name, p.id)}<div><b>${esc(p.name)}</b><small>${esc(p.email)}</small></div></div></td><td>${esc(p.role)}</td><td>${p.active ? "Active" : "Disabled"}</td><td>${action("employee/" + p.id, "Manage", "textbtn")}</td></tr>`).join("")}</tbody></table></div></section>`
  );
}
async function render(refresh = true) {
  const stamp = ++refreshStamp;
  if (refresh) {
    const data = await api("workspace");
    if (stamp !== refreshStamp) return;
    state = data;
  }
  if (!navItems().some((n) => n[0] === page)) page = "Overview";
  let content;
  if (page === "Overview") content = overview();
  if (page === "Stores") content = storesPage();
  if (page === "Sheets") content = sheetsPage();
  if (page === "Performance")
    content = reportsPage(
      can("reports.read")
        ? await api(
            "reports?day=" + encodeURIComponent(reportDay || state.today),
          )
        : state.performance,
    );
  if (page === "Activity log") {
    auditPages = await api("audit");
    content = auditPage();
  }
  if (page === "Team & access") {
    permissionData = await api("people");
    content = teamPage();
  }
  if (stamp === refreshStamp) frame(content);
}
