"use strict";
function storeModal(sid) {
  const s = state.stores.find((item) => item.id === sid);
  visitedStore = sid;
  const mine =
    own(s) &&
    can("work.write") &&
    (s.status !== "Done" || can("stores.update"));
  const editing =
    writable(s) &&
    (can("stores.update") ||
      ["links.add", "links.update", "links.delete"].some(can));
  const discovery = writable(s) && can("offers.write");
  const sheet = state.sheets.find((a) => a.id === s.sheet);
  const actions = [
    mine && !timer(s)
      ? action(
          "start/" + sid,
          s.status === "Done" ? "Start update timer" : "Start work",
          "primary",
          "clock",
        )
      : "",
    mine && timer(s)
      ? (s.status === "Done"
          ? ""
          : action("complete/" + sid, "Save & complete", "primary", "check")) +
        action("pause/" + sid, "Pause timer")
      : "",
    editing ? action("edit/" + sid, "Edit store") : "",
    can("assign.write") ? action("assign/" + sid, "Assign") : "",
    writable(s) && can("stores.delete") && (!s.url || can("links.delete"))
      ? action("delete/" + sid, "Delete", "danger")
      : "",
  ].join("");
  modal(
    s.name,
    `<div class="detail-meta">${chip(status(s))}<span>${esc(s.kind)} store</span></div><dl class="facts"><dt>Website</dt><dd>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url)} ${icon("external", 13)}</a>` : "No link assigned"}</dd><dt>Category</dt><dd>${esc(s.category || "—")}</dd><dt>Assigned to</dt><dd>${esc(person(s.person))}</dd><dt>Sheet</dt><dd>${sheet ? `<a href="${esc(sheet.url)}" target="_blank" rel="noopener noreferrer">${esc(sheet.name)}</a>` : "—"}</dd>${timer(s) ? `<dt>Working since</dt><dd>${shortTime(timer(s).start)}</dd>` : ""}<dt>Notes</dt><dd>${esc(s.notes || "—")}</dd></dl><div class="actions">${actions}</div><div class="sectionline"><h3>Saved offers (${s.offers.length})</h3>${discovery ? action("offers/" + sid, "Edit offers", "textbtn") + action("discover/" + sid, "Discover offers", "secondary", "scan") : ""}</div>${s.offers.map(offerCard).join("") || note("Reviewed offers will appear here.")}`,
    "Store details",
  );
}
function offerCard(o) {
  return `<article class="offer"><b>${esc(o.title)}</b>${o.evidence && o.evidence !== o.title ? `<p class="hint">Merchant wording · ${esc(o.evidence)}</p>` : ""}<div class="offermeta">${o.code ? `<code>${esc(o.code)}</code>` : ""}<span>${esc(o.verification || "Manual offer")}</span></div>${o.trials?.length ? `<ul>${o.trials.map((t) => `<li>${esc(t.product)} · ${esc(t.price)} · ${esc(t.result)}${t.savingsMinor ? ` · saved ${esc(t.savingsMinor)} minor units (${esc(t.currency)})` : ""}</li>`).join("")}</ul>` : ""}${o.source ? `<a href="${esc(o.source)}" target="_blank" rel="noopener noreferrer">Source page ${icon("external", 12)}</a>` : ""}</article>`;
}
function form(id, body, submit = "Save changes", attrs = "") {
  return `<form id="${id}" ${attrs}>${body}<div class="form-actions">${action("close", "Cancel")}<button class="primary">${esc(submit)}</button></div></form>`;
}
function editStore(s) {
  const metadata = !s || can("stores.update");
  const linkEditable = !s
    ? can("links.add")
    : s.url
      ? can("links.update") || can("links.delete")
      : can("links.add");
  const fields =
    input(
      "Store name",
      "name",
      s?.name || "",
      "text",
      "required maxlength=100 " + (metadata ? "" : "disabled"),
    ) +
    input(
      "Website URL",
      "url",
      s?.url || "",
      "url",
      "maxlength=2000 placeholder='https://store.com' " +
        (linkEditable ? "" : "disabled"),
    ) +
    (!linkEditable
      ? note("Website links are protected by your administrator.")
      : "") +
    input(
      "Category",
      "category",
      s?.category || "",
      "text",
      "maxlength=80 " + (metadata ? "" : "disabled"),
    ) +
    (s
      ? `<label>Store notes<textarea name="notes" maxlength="4000" ${metadata ? "" : "disabled"}>${esc(s.notes)}</textarea></label>`
      : "") +
    (!s && can("assign.write")
      ? select("Assigned employee", "person", employees()) +
        select("Sheet", "sheet", sheetOptions())
      : "");
  modal(
    s ? "Edit store" : "Add a store",
    form(
      "storeForm",
      fields,
      s ? "Save changes" : "Create store",
      `data-id="${s?.id || ""}"`,
    ),
  );
}
function employeeForm(id) {
  const p = permissionData.people.find((p) => p.id === Number(id));
  const options = Object.keys(permissionData.defaults).map((r) => [r, r]);
  let body = "";
  if (!p)
    body =
      input("Full name", "name", "", "text", "required maxlength=80") +
      input("Email address", "email", "", "email", "required");
  body += select("Role", "role", options, p?.role || "Store Adder");
  body += input(
    p ? "Set new password (optional)" : "Initial password",
    "password",
    "",
    "password",
    `${p ? "" : "required"} minlength=10 maxlength=256 autocomplete=new-password`,
  );
  if (p) {
    body += `<label class="checkline"><input type="checkbox" name="active" ${p.active ? "checked" : ""}>Account active</label><fieldset id="grants"><legend>Feature permissions</legend>${Object.entries(
      permissionData.permissions,
    )
      .map(
        ([k, v]) =>
          `<label class="checkline"><input type="checkbox" name="grant" value="${k}" ${p.permissions.includes(k) ? "checked" : ""} ${p.role === "Admin" ? "disabled" : ""}>${esc(v)}</label>`,
      )
      .join("")}</fieldset>`;
  }
  modal(
    p ? p.name : "Add employee",
    form(
      "employeeForm",
      body,
      p ? "Save access" : "Create account",
      `data-id="${p?.id || ""}"`,
    ),
    "Team & access",
  );
}
function offerFields(o, index) {
  return (
    '<fieldset class="manual" data-index="' +
    index +
    '"><legend>Offer</legend>' +
    input("Offer details", "title", o.title || "", "text", "maxlength=600") +
    input(
      "Coupon code (optional)",
      "code",
      o.code || "",
      "text",
      "maxlength=80",
    ) +
    '<label class="checkline"><input name="remove" type="checkbox">Remove offer</label></fieldset>'
  );
}
function discoveryForm(s) {
  discoveryDraft = null;
  modal(
    "Discover offers",
    `<form id="discoverForm" data-id="${s.id}">${input("Store website", "url", s.url, "url", "required " + (can("links.update") ? "" : "readonly"))}${note("Checks homepage promotions and linked sale pages. Supported guest carts are tested across sampled product prices.")}<button class="primary" ${!s.url && !can("links.update") ? "disabled" : ""}>${icon("scan", 16)} Analyze website</button></form>`,
    s.name,
  );
}
function review(s, result) {
  discoveryDraft = result.offers;
  const choices = result.offers
    .map(
      (o, i) =>
        `<div class="reviewrow"><input aria-label="Select offer ${i + 1}" type="checkbox" name="offer" value="${i}" checked>${offerCard(o)}</div>`,
    )
    .join("");
  modal(
    "Review discovered offers",
    `<p>${result.offers.length} offers found · ${esc(result.engine)}</p>${result.warnings.map(note).join("")}${choices ? `<form id="reviewForm" data-id="${s.id}">${choices}<div class="form-actions">${action("store/" + s.id, "Back")}<button class="primary" name="mode" value="save">Save offers</button>${own(s) && can("work.write") && timer(s) && s.status !== "Done" ? '<button class="primary" name="mode" value="complete">Save & complete</button>' : ""}</div></form>` : empty("No supported promotions found on these pages.")}`,
    s.name,
  );
}
async function afterSave(message, sid) {
  dialog.close();
  await render();
  if (sid && state.stores.some((s) => s.id === sid)) storeModal(sid);
  toast(message);
}
async function handleAction(value) {
  const [act, id] = value.split("/"),
    sid = Number(id),
    s = state?.stores.find((item) => item.id === sid);
  switch (act) {
    case "menu":
      document.querySelector(".layout").classList.toggle("nav-open");
      break;
    case "close":
      dialog.close();
      break;
    case "logout":
      await api("logout", {});
      state = null;
      page = "Overview";
      reportDay = "";
      scope = "All";
      search = "";
      auth(false);
      break;
    case "allStores":
      page = "Stores";
      await render(false);
      break;
    case "newStore":
      editStore(null);
      break;
    case "store":
      storeModal(sid);
      break;
    case "edit":
      editStore(s);
      break;
    case "assign":
      modal(
        "Assign store",
        form(
          "assignForm",
          select("Employee", "person", employees(), s.person) +
            select("Work sheet", "sheet", sheetOptions(), s.sheet) +
            select(
              "Assignment type",
              "kind",
              [
                ["Add", "Add store"],
                ["Update", "Update store"],
              ],
              s.kind,
            ) +
            note(
              "Assigning opens a pending task. Completed stores require a different employee.",
            ),
          "Save assignment",
          `data-id="${sid}"`,
        ),
        s.name,
      );
      break;
    case "sheet": {
      const sheet = state.sheets.find((i) => i.id === sid);
      modal(
        sheet ? "Edit sheet" : "Add sheet",
        form(
          "sheetForm",
          input("Sheet name", "name", sheet?.name || "", "text", "required") +
            input("Sheet URL", "url", sheet?.url || "", "url", "required") +
            select("Assigned employee", "person", employees(), sheet?.person),
          "Save sheet",
          `data-id="${sheet?.id || ""}"`,
        ),
      );
      break;
    }
    case "start":
    case "pause":
      await api(`stores/${sid}/${act}`, { version: s.version });
      await afterSave(
        act === "start" ? "Work timer started." : "Work timer paused.",
        sid,
      );
      break;
    case "delete":
      modal(
        "Delete this store?",
        form(
          "deleteForm",
          note(
            `${s.name} will leave the store list. Its activity and work history will remain available.`,
          ),
          "Delete store",
          `data-id="${sid}"`,
        ),
      );
      break;
    case "complete":
      modal(
        "Complete store",
        form(
          "completeForm",
          `<label>Completion notes<textarea name="notes" maxlength="4000">${esc(s.notes)}</textarea></label>` +
            note(
              "Saving closes the timer and records this assignment in the daily report.",
            ),
          "Save & complete",
          `data-id="${sid}"`,
        ),
        s.name,
      );
      break;
    case "employee":
      employeeForm(id);
      break;
    case "offers": {
      const fields = s.offers.map((o, i) => offerFields(o, i)).join("");
      modal(
        "Edit offers",
        form(
          "offersForm",
          '<div id="offerFields">' +
            fields +
            "</div>" +
            action("manualOffer", "Add offer", "secondary", "plus") +
            note("Editing offer text or a code marks it as employee entered."),
          "Save offers",
          'data-id="' + sid + '"',
        ),
        s.name,
      );
      break;
    }
    case "manualOffer":
      document
        .querySelector("#offerFields")
        .insertAdjacentHTML("beforeend", offerFields({}, -1));
      break;
    case "discover":
      discoveryForm(s);
      break;
    case "older": {
      const more = await api("audit?before=" + auditPages.at(-1).id);
      auditPages.push(...more);
      frame(auditPage());
      if (!more.length) {
        root.querySelector('[data-act="older"]')?.remove();
        toast("All activity loaded.");
      }
      break;
    }
  }
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b || busy) return;
  try {
    if (b.dataset.page) {
      page = b.dataset.page;
      await render();
      window.scrollTo(0, 0);
    } else if (b.dataset.filter) {
      scope = b.dataset.filter;
      frame(storesPage());
    } else if (b.dataset.act) {
      b.disabled = true;
      try {
        await handleAction(b.dataset.act);
      } finally {
        b.disabled = false;
      }
    }
  } catch (error) {
    showError(error);
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    search = e.target.value;
    document.querySelector("#results").innerHTML = storeTable(filtered());
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "reportDay" && e.target.value) {
    reportDay = e.target.value;
    try {
      await render(false);
    } catch (error) {
      showError(error);
    }
  }
  if (e.target.name === "role" && e.target.form?.id === "employeeForm") {
    const role = e.target.value;
    for (const box of e.target.form.querySelectorAll('[name="grant"]')) {
      box.checked = permissionData.defaults[role].includes(box.value);
      box.disabled = role === "Admin";
    }
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  const f = e.target,
    data = new FormData(f),
    obj = Object.fromEntries(data),
    sid = parseId(f.dataset.id),
    s = state?.stores.find((k) => k.id === sid);
  const submit = e.submitter,
    original = submit?.textContent;
  busy = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent =
      f.id === "discoverForm" ? "Analyzing storefront…" : "Saving…";
  }
  try {
    if (f.id === "auth") {
      const setup = f.dataset.setup === "true";
      obj.sample = data.has("sample");
      const result = await api(setup ? "setup" : "login", obj);
      csrf = result.csrf;
      await render();
      return;
    }
    if (f.id === "discoverForm") {
      const result = await api("analyze", { id: sid, url: obj.url });
      review(s, result);
      return;
    }
    if (f.id === "reviewForm") {
      const selected = data
        .getAll("offer")
        .map((i) => discoveryDraft[Number(i)]);
      if (!selected.length) throw Error("Select at least one offer.");
      const offers = [
        ...new Map(
          [...s.offers, ...selected].map((o) => [o.title.toLowerCase(), o]),
        ).values(),
      ];
      await api(
        `stores/${sid}/${submit.value === "complete" ? "complete" : "edit"}`,
        { version: s.version, offers },
      );
      await afterSave("Reviewed offers saved.", sid);
      return;
    }
    if (f.id === "offersForm") {
      const offers = [];
      for (const group of f.querySelectorAll(".manual")) {
        if (group.querySelector('[name="remove"]').checked) continue;
        const title = group.querySelector('[name="title"]').value.trim();
        const code = group.querySelector('[name="code"]').value.trim();
        if (!title) throw Error("Enter offer details or select Remove offer.");
        const old = s.offers[Number(group.dataset.index)];
        offers.push(
          old && old.title === title && (old.code || "") === code
            ? old
            : { title, code, verification: "Employee entered" },
        );
      }
      await api("stores/" + sid + "/edit", { version: s.version, offers });
      await afterSave("Store offers updated.", sid);
      return;
    }
    if (f.id === "employeeForm") {
      if (sid)
        Object.assign(obj, {
          id: sid,
          active: data.has("active"),
          permissions:
            obj.role === "Admin"
              ? permissionData.defaults.Admin
              : data.getAll("grant"),
        });
      await api("people", obj);
      await afterSave("Employee account saved.");
      return;
    }
    if (f.id === "sheetForm") {
      await api("sheets", { ...obj, id: sid, person: parseId(obj.person) });
      await afterSave("Sheet saved.");
      return;
    }
    if (f.id === "storeForm" && !sid) {
      const newStore = await api("stores", {
        ...obj,
        person: parseId(obj.person),
        sheet: parseId(obj.sheet),
      });
      await afterSave("Store created.", newStore.id);
      return;
    }
    const commands = {
      storeForm: "edit",
      assignForm: "assign",
      completeForm: "complete",
      deleteForm: "delete",
    };
    if (commands[f.id]) {
      if (f.id === "assignForm") {
        obj.person = parseId(obj.person);
        obj.sheet = parseId(obj.sheet);
      }
      await api(`stores/${sid}/${commands[f.id]}`, {
        ...obj,
        version: s.version,
      });
      await afterSave("Store saved.", f.id === "deleteForm" ? null : sid);
    }
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    if (submit) {
      submit.disabled = false;
      submit.textContent = original;
    }
  }
});
dialog.addEventListener("cancel", (e) => {
  if (busy) e.preventDefault();
});
setInterval(() => {
  if (
    state &&
    page === "Overview" &&
    !busy &&
    !dialog.open &&
    !document.hidden
  ) {
    render().catch(showError);
  }
}, 30000);
(async () => {
  try {
    const session = await api("session");
    csrf = session.csrf || "";
    if (session.person) await render();
    else auth(session.setup);
  } catch (error) {
    root.textContent = error.message;
  }
})();
