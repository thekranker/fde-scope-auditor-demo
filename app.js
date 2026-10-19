(function () {
  "use strict";

  var D = window.DEMO;
  var STEPS = ["scope", "activity", "build", "report"];
  var SIM_INTERVAL_MS = 1000;

  var state = freshState();

  function freshState() {
    return {
      approved: false,
      shown: 0,          // number of events revealed in the live feed
      running: false,
      pausedOnFlag: false,
      timer: null,
      component: "C1",
    };
  }

  // ---------- helpers ----------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function scopeById(id) {
    for (var i = 0; i < D.scope.length; i++) if (D.scope[i].id === id) return D.scope[i];
    return null;
  }

  function componentById(id) {
    for (var i = 0; i < D.components.length; i++) if (D.components[i].id === id) return D.components[i];
    return null;
  }

  function flaggedEvents() {
    return D.events.filter(function (e) { return !e.scopeId; });
  }

  function eventsForScope(id) {
    return D.events.filter(function (e) { return e.scopeId === id; });
  }

  function accessBadge(row) {
    var cls = row.access === "write" ? "badge write" : "badge read";
    var note = row.accessNote ? '<span class="access-note">' + esc(row.accessNote) + "</span>" : "";
    return '<span class="' + cls + '">' + esc(row.access) + "</span>" + note;
  }

  function classBadge(c) {
    var k = /PII/.test(c) ? "pii" : /Confidential|Financial/.test(c) ? "conf" : "internal";
    return '<span class="badge cls-' + k + '">' + esc(c) + "</span>";
  }

  // Purely visual "hash" for the tamper-evident panel. Not cryptographic.
  function fakeHash(str) {
    var out = "";
    for (var seed = 0; seed < 8; seed++) {
      var h = 0x811c9dc5 ^ (seed * 0x9e3779b1);
      for (var i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      out += ("00000000" + (h >>> 0).toString(16)).slice(-8);
    }
    return out;
  }

  function hashChain() {
    var prev = "0".repeat(64);
    return D.events.map(function (e, i) {
      var id = "EVT-7F3A-" + ("000" + (i + 1)).slice(-4);
      var h = fakeHash(prev + "|" + id + "|" + e.ts + "|" + e.action + "|" + e.source);
      var rec = { id: id, prev: prev, hash: h, event: e };
      prev = h;
      return rec;
    });
  }

  function short(h) { return h.slice(0, 8) + "…" + h.slice(-6); }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 3200);
  }

  // ---------- routing ----------

  function currentStep() {
    var h = (location.hash || "").replace("#", "");
    return STEPS.indexOf(h) >= 0 ? h : "scope";
  }

  function go(step) {
    if (location.hash !== "#" + step) location.hash = step;
    else render();
  }

  function render() {
    var step = currentStep();
    if (step !== "activity") stopSim();

    document.querySelectorAll(".stepper a").forEach(function (a) {
      var s = a.getAttribute("data-step");
      var active = s === step;
      a.classList.toggle("active", active);
      a.classList.toggle("done", STEPS.indexOf(s) < STEPS.indexOf(step));
      if (active) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    });

    var idx = STEPS.indexOf(step);
    document.getElementById("prev-btn").disabled = idx === 0;
    var next = document.getElementById("next-btn");
    next.disabled = idx === STEPS.length - 1;

    var app = document.getElementById("app");
    app.innerHTML = { scope: viewScope, activity: viewActivity, build: viewBuild, report: viewReport }[step]();
    bind(step);
  }

  // ---------- 1. Scope ----------

  function deploymentHeader(extra) {
    var d = D.deployment;
    return (
      '<section class="card deploy-head">' +
        '<div class="deploy-title">' +
          '<div><p class="eyebrow">Deployment ' + esc(d.id) + "</p><h1>" + esc(d.name) + "</h1></div>" +
          (extra || "") +
        "</div>" +
        '<dl class="meta">' +
          "<div><dt>Vendor</dt><dd>" + esc(d.vendor) + "</dd></div>" +
          "<div><dt>Customer</dt><dd>" + esc(d.customer) + "</dd></div>" +
          "<div><dt>FDE</dt><dd>" + esc(d.fde) + "</dd></div>" +
          "<div><dt>Planned dates</dt><dd>" + esc(d.plannedStart) + " – " + esc(d.plannedEnd) + "</dd></div>" +
        "</dl>" +
        '<p class="deploy-summary">' + esc(d.summary) + "</p>" +
      "</section>"
    );
  }

  function statusBlock() {
    if (state.approved) {
      return (
        '<div class="status-block">' +
          '<span class="badge status ok">Approved</span>' +
          '<p class="approval-line">Approved by ' + esc(D.approval.approver) + ", " + esc(D.approval.team) +
          "<br><span class=\"muted\">" + esc(D.approval.timestamp) + "</span></p>" +
        "</div>"
      );
    }
    return (
      '<div class="status-block">' +
        '<span class="badge status pending">Pending security review</span>' +
        '<button class="btn" id="approve-btn" type="button">Approve scope</button>' +
      "</div>"
    );
  }

  function scopeTable() {
    var rows = D.scope.map(function (r) {
      return (
        "<tr>" +
          '<td class="mono id-col">' + esc(r.id) + "</td>" +
          '<td data-label="System"><strong>' + esc(r.system) + "</strong></td>" +
          '<td data-label="Endpoint / resource" class="resource">' + esc(r.resource) + "</td>" +
          '<td data-label="Access">' + accessBadge(r) + "</td>" +
          '<td data-label="Data">' + classBadge(r.classification) + "</td>" +
          '<td data-label="Reason" class="reason">' + esc(r.reason) + "</td>" +
        "</tr>"
      );
    }).join("");
    return (
      '<div class="table-wrap"><table class="data-table stack-sm">' +
        "<thead><tr><th>ID</th><th>System</th><th>Endpoint or resource</th><th>Access</th><th>Data</th><th>Reason</th></tr></thead>" +
        "<tbody>" + rows + "</tbody></table></div>"
    );
  }

  function viewScope() {
    return (
      deploymentHeader(statusBlock()) +
      '<section class="card">' +
        '<div class="card-head"><h2>Requested access</h2><p class="muted">' + D.scope.length +
        " items requested by " + esc(D.deployment.vendor) + ". Anything not listed here is out of scope.</p></div>" +
        scopeTable() +
      "</section>"
    );
  }

  // ---------- 2. Live activity ----------

  function eventRow(e, isNew) {
    var oos = !e.scopeId;
    var badge = oos
      ? '<span class="badge oos">Out of scope</span>'
      : '<span class="badge ins">In scope · ' + esc(e.scopeId) + "</span>";
    var flag = oos
      ? '<div class="flag-note"><strong>' + esc(e.flag.title) + ".</strong> " + esc(e.flag.explanation) + "</div>"
      : "";
    return (
      '<li class="event' + (oos ? " is-oos" : "") + (isNew ? " is-new" : "") + '">' +
        '<div class="ev-time mono">' + esc(e.ts) + "</div>" +
        '<div class="ev-actor"><span class="actor-dot ' + e.actor + '"></span>' + esc(D.actors[e.actor]) + "</div>" +
        '<div class="ev-main"><span class="ev-system">' + esc(e.system) + '</span><code class="ev-action">' + esc(e.action) + "</code></div>" +
        '<div class="ev-source"><span class="src-label">Source</span> ' + esc(e.source) + "</div>" +
        '<div class="ev-badge">' + badge + "</div>" +
        flag +
      "</li>"
    );
  }

  function feedItems(newIndex) {
    var list = D.events.slice(0, state.shown);
    if (!list.length) {
      return '<li class="empty">No events yet. Click <strong>Start simulation</strong> to replay the deployment week.</li>';
    }
    // newest first so the latest event stays visible on a shared screen
    return list.map(function (e, i) { return eventRow(e, i === newIndex); }).reverse().join("");
  }

  function feedCounts() {
    var shownEvents = D.events.slice(0, state.shown);
    var oos = shownEvents.filter(function (e) { return !e.scopeId; }).length;
    return (
      '<span class="count"><strong>' + state.shown + "</strong> / " + D.events.length + " events</span>" +
      '<span class="count ' + (oos ? "bad" : "") + '"><strong>' + oos + "</strong> out of scope</span>"
    );
  }

  function simButtons() {
    var done = state.shown >= D.events.length;
    var label = state.running ? "Pause" : state.shown === 0 ? "Start simulation" : done ? "Replay" : "Resume";
    return (
      '<button class="btn" id="sim-btn" type="button">' + label + "</button>" +
      '<button class="btn ghost" id="showall-btn" type="button"' + (done ? " disabled" : "") + ">Show all</button>" +
      '<button class="btn ghost" id="clear-btn" type="button"' + (state.shown === 0 ? " disabled" : "") + ">Clear</button>"
    );
  }

  function pausedNote() {
    return state.pausedOnFlag
      ? '<div class="alert bad" id="paused-note"><strong>Out-of-scope activity detected.</strong> Simulation paused so you can look at it. Click Resume to continue.</div>'
      : "";
  }

  function viewActivity() {
    var notApproved = state.approved
      ? ""
      : '<div class="alert warn">Scope has not been approved yet. Events are being checked against the <a href="#scope">requested scope</a>.</div>';
    return (
      '<section class="card">' +
        '<div class="card-head row">' +
          "<div><h2>Live activity</h2>" +
          '<p class="muted">Independent, read-only watcher for ' + esc(D.deployment.name) + ".</p></div>" +
          '<div class="sim-controls" id="sim-controls">' + simButtons() + "</div>" +
        "</div>" +
        '<div class="provenance">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>' +
          "<p>Records are read from " + esc(D.deployment.customer) + "'s own logs (Okta System Log, Zendesk audit log, Salesforce Event Monitoring, API gateway) and stored append-only. The FDE cannot edit them.</p>" +
        "</div>" +
        notApproved +
        '<div class="feed-bar" id="feed-counts">' + feedCounts() + "</div>" +
        '<div id="paused-wrap">' + pausedNote() + "</div>" +
        '<ol class="feed" id="feed">' + feedItems(-1) + "</ol>" +
      "</section>"
    );
  }

  function refreshFeed(newIndex) {
    var feed = document.getElementById("feed");
    if (!feed) return;
    feed.innerHTML = feedItems(newIndex);
    document.getElementById("feed-counts").innerHTML = feedCounts();
    document.getElementById("sim-controls").innerHTML = simButtons();
    document.getElementById("paused-wrap").innerHTML = pausedNote();
    bindSimButtons();
  }

  function tick() {
    if (state.shown >= D.events.length) { stopSim(); refreshFeed(-1); return; }
    var e = D.events[state.shown];
    state.shown++;
    if (!e.scopeId) {
      stopSim();
      state.pausedOnFlag = true;
    }
    if (state.shown >= D.events.length) stopSim();
    refreshFeed(state.shown - 1);
  }

  function startSim() {
    if (state.shown >= D.events.length) state.shown = 0;
    state.pausedOnFlag = false;
    state.running = true;
    tick();
    if (state.running) state.timer = setInterval(tick, SIM_INTERVAL_MS);
  }

  function stopSim() {
    state.running = false;
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  function bindSimButtons() {
    var sim = document.getElementById("sim-btn");
    if (!sim) return;
    sim.onclick = function () {
      if (state.running) { stopSim(); refreshFeed(-1); }
      else startSim();
    };
    document.getElementById("showall-btn").onclick = function () {
      stopSim();
      state.pausedOnFlag = false;
      state.shown = D.events.length;
      refreshFeed(-1);
    };
    document.getElementById("clear-btn").onclick = function () {
      stopSim();
      state.pausedOnFlag = false;
      state.shown = 0;
      refreshFeed(-1);
    };
  }

  // ---------- 3. How it was built ----------

  function viewBuild() {
    var summary =
      '<section class="card summary-card">' +
        '<p class="eyebrow">Plain-language summary</p>' +
        '<h2>What Priya S. built for ' + esc(D.deployment.customer) + "</h2>" +
        D.buildSummary.map(function (p, i) {
          return "<p" + (i === D.buildSummary.length - 1 ? ' class="summary-flag"' : "") + ">" + esc(p) + "</p>";
        }).join("") +
        '<p class="fine">Reconstructed from ' + D.events.length + " recorded events and the vendor's change history. Describes what was built and touched, not whether the agent's replies are correct.</p>" +
      "</section>";

    var timeline =
      '<section class="card">' +
        '<div class="card-head"><h2>Work timeline</h2><p class="muted">Phases in the order they happened.</p></div>' +
        '<ol class="timeline">' +
          D.phases.map(function (p) {
            var hasFlag = p.changes.some(function (c) { return c.flagged; });
            return (
              '<li class="phase' + (hasFlag ? " has-flag" : "") + '">' +
                '<div class="phase-when"><span class="phase-day">' + esc(p.day) + '</span><span class="muted">' + esc(p.date) + "</span></div>" +
                '<div class="phase-body">' +
                  "<h3>" + esc(p.title) + "</h3>" +
                  '<ul class="steps">' + p.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>" +
                  '<ul class="changes">' +
                    p.changes.map(function (c) {
                      return (
                        '<li class="' + (c.flagged ? "flagged" : "") + '"><code>' + esc(c.ref) + "</code> " + esc(c.text) +
                        (c.flagged ? ' <span class="badge oos">Out of scope</span>' : "") + "</li>"
                      );
                    }).join("") +
                  "</ul>" +
                  '<div class="phase-comps">' +
                    p.components.map(function (id) {
                      return '<button type="button" class="chip comp-link" data-comp="' + id + '">' + esc(componentById(id).name) + "</button>";
                    }).join("") +
                  "</div>" +
                "</div>" +
              "</li>"
            );
          }).join("") +
        "</ol>" +
      "</section>";

    var comps =
      '<section class="card" id="components">' +
        '<div class="card-head"><h2>Components</h2><p class="muted">Click a component to see what it touches.</p></div>' +
        '<div class="comp-layout">' +
          '<div class="comp-list" role="tablist">' +
            D.components.map(function (c) {
              var bad = c.outOfScope && c.outOfScope.length;
              return (
                '<button type="button" role="tab" class="comp-btn' + (state.component === c.id ? " active" : "") + (bad ? " has-flag" : "") +
                '" data-comp="' + c.id + '" aria-selected="' + (state.component === c.id) + '">' +
                  '<span class="comp-name">' + esc(c.name) + "</span>" +
                  '<span class="comp-sys muted">' + esc(c.systems.join(", ")) + "</span>" +
                  (bad ? '<span class="badge oos small">1 out of scope</span>' : "") +
                "</button>"
              );
            }).join("") +
          "</div>" +
          '<div class="comp-detail" id="comp-detail" role="tabpanel">' + componentDetail() + "</div>" +
        "</div>" +
      "</section>";

    return summary + timeline + comps + dataFlow();
  }

  function componentDetail() {
    var c = componentById(state.component);
    var evCount = D.events.filter(function (e) { return e.component === c.id; }).length;
    var scopeRows = c.scopeIds.length
      ? '<ul class="scope-links">' + c.scopeIds.map(function (id) {
          var r = scopeById(id);
          return (
            '<li><span class="mono id-pill">' + id + "</span><div><strong>" + esc(r.system) + "</strong> · " + esc(r.resource) +
            '<div class="scope-link-meta">' + accessBadge(r) + classBadge(r.classification) + "</div></div></li>"
          );
        }).join("") + "</ul>"
      : '<p class="muted">No scope rows of its own. It reaches Northwind systems only through the other components.</p>';
    var oos = c.outOfScope && c.outOfScope.length
      ? '<div class="alert bad"><strong>Outside approved scope:</strong><ul>' +
          c.outOfScope.map(function (o) { return "<li><code>" + esc(o) + "</code></li>"; }).join("") +
        "</ul></div>"
      : "";
    return (
      "<h3>" + esc(c.name) + "</h3>" +
      "<p>" + esc(c.description) + "</p>" +
      '<dl class="kv">' +
        "<div><dt>Systems</dt><dd>" + esc(c.systems.join(", ")) + "</dd></div>" +
        "<div><dt>Permissions</dt><dd>" + esc(c.permissions.join("; ")) + "</dd></div>" +
        "<div><dt>Recorded events</dt><dd>" + evCount + "</dd></div>" +
      "</dl>" +
      '<h4>Linked scope rows</h4>' + scopeRows + oos
    );
  }

  function dataFlow() {
    var arrow = '<div class="flow-arrow" aria-hidden="true"><svg viewBox="0 0 40 16"><path d="M0 8h34M28 2l7 6-7 6" fill="none" stroke="currentColor" stroke-width="2"/></svg></div>';
    var nodes = D.dataFlow.map(function (n) {
      var branch = n.id === "f3"
        ? '<div class="flow-branch"><span class="branch-line" aria-hidden="true"></span><div class="flow-node oos-node"><strong>BillingAccount</strong><span>Read once on Fri 9 Oct</span><span class="badge oos small">Out of scope</span></div></div>'
        : "";
      return (
        '<div class="flow-cell">' +
          '<div class="flow-node">' +
            "<strong>" + esc(n.label) + "</strong><span>" + esc(n.sub) + "</span>" +
            '<div class="flow-tags">' + n.tags.map(function (t) { return '<span class="tag tag-' + t.k + '">' + esc(t.t) + "</span>"; }).join("") + "</div>" +
          "</div>" + branch +
        "</div>"
      );
    });
    return (
      '<section class="card">' +
        '<div class="card-head"><h2>Data flow</h2><p class="muted">How a ticket becomes a draft reply.</p></div>' +
        '<div class="flow">' + nodes.join(arrow) + "</div>" +
        '<div class="flow-notes">' +
          D.dataNotes.map(function (n) {
            return '<div class="flow-note note-' + n.k + '"><h4>' + esc(n.title) + "</h4><p>" + esc(n.text) + "</p></div>";
          }).join("") +
        "</div>" +
      "</section>"
    );
  }

  // ---------- 4. Report ----------

  function viewReport() {
    var used = D.scope.filter(function (r) { return eventsForScope(r.id).length > 0; });
    var flags = flaggedEvents();
    var approvalLine = state.approved
      ? "Approved scope: signed off by " + esc(D.approval.approver) + ", " + esc(D.approval.team) + " on " + esc(D.approval.timestamp) + "."
      : 'Scope not yet approved in this demo. <a href="#scope">Approve it on step 1</a>.';

    var stats =
      '<div class="stats">' +
        stat(D.scope.length, "Approved items") +
        stat(used.length, "Items actually used") +
        stat(D.events.length, "Events recorded") +
        stat(flags.length, "Out-of-scope events", flags.length ? "bad" : "ok") +
      "</div>";

    var rows = D.scope.map(function (r) {
      var n = eventsForScope(r.id).length;
      var status = n
        ? '<span class="badge ins">Used</span> <span class="muted">' + n + " event" + (n === 1 ? "" : "s") + "</span>"
        : '<span class="badge neutral">Not used</span> <span class="muted">Consider removing access</span>';
      return (
        "<tr>" +
          '<td class="mono id-col">' + r.id + "</td>" +
          '<td data-label="System"><strong>' + esc(r.system) + "</strong></td>" +
          '<td data-label="Resource" class="resource">' + esc(r.resource) + "</td>" +
          '<td data-label="Access">' + accessBadge(r) + "</td>" +
          '<td data-label="Status">' + status + "</td>" +
        "</tr>"
      );
    }).join("");
    rows += flags.map(function (e) {
      return (
        '<tr class="row-oos">' +
          '<td class="mono id-col">—</td>' +
          '<td data-label="System"><strong>' + esc(e.system) + "</strong></td>" +
          '<td data-label="Resource" class="resource"><code>' + esc(e.action) + "</code></td>" +
          '<td data-label="Access"><span class="badge read">read</span></td>' +
          '<td data-label="Status"><span class="badge oos">Not approved</span> <span class="muted">Used 1 time</span></td>' +
        "</tr>"
      );
    }).join("");

    var flagCards = flags.map(function (e) {
      var comp = componentById(e.component);
      return (
        '<section class="card flag-card">' +
          '<div class="card-head row"><div><p class="eyebrow bad">Flag · ' + esc(e.flag.recordId) + "</p><h2>" + esc(e.flag.title) + "</h2></div>" +
          '<span class="badge oos">Out of scope</span></div>' +
          '<dl class="kv two">' +
            "<div><dt>What happened</dt><dd>" + esc(e.flag.explanation) + "</dd></div>" +
            "<div><dt>When</dt><dd>" + esc(e.ts) + " ET</dd></div>" +
            "<div><dt>Actor</dt><dd>" + esc(D.actors[e.actor]) + " (" + esc(comp.name) + ")</dd></div>" +
            "<div><dt>Call</dt><dd><code>" + esc(e.action) + "</code></dd></div>" +
            "<div><dt>Record source</dt><dd>" + esc(e.source) + " (customer-owned, read-only)</dd></div>" +
            "<div><dt>Data involved</dt><dd>" + classBadge(e.flag.dataClass) + "</dd></div>" +
          "</dl>" +
          '<div class="next-step"><span class="eyebrow">Suggested next step</span><strong>' + esc(e.flag.nextStep) + "</strong>" +
          "<span class=\"muted\">Relay AI either adds BillingAccount to the scope for " + esc(D.deployment.customer) + " to approve, or removes the call (change 5a8e0f7).</span></div>" +
        "</section>"
      );
    }).join("");

    var chain = hashChain();
    var tail = chain.slice(-5).reverse();
    var tamper =
      '<section class="card">' +
        '<div class="card-head row"><div><h2>Tamper-evident record</h2>' +
        '<p class="muted">Each record includes the hash of the one before it, so editing or deleting any record breaks the chain.</p></div>' +
        '<span class="badge ins">Chain intact · ' + chain.length + " records</span></div>" +
        '<div class="chain">' +
          tail.map(function (r) {
            var oos = !r.event.scopeId;
            return (
              '<div class="chain-rec' + (oos ? " is-oos" : "") + '">' +
                '<div class="chain-id mono">' + r.id + "</div>" +
                '<div class="chain-hash"><span class="muted">prev</span> <code>' + short(r.prev) + "</code></div>" +
                '<div class="chain-hash"><span class="muted">hash</span> <code>' + short(r.hash) + "</code></div>" +
                '<div class="chain-what muted">' + esc(r.event.ts) + " · " + esc(r.event.system) + "</div>" +
              "</div>"
            );
          }).join("") +
        "</div>" +
        '<p class="fine">Showing the 5 most recent records. Chain head: <code>' + chain[chain.length - 1].hash + "</code>. Illustrative only.</p>" +
      "</section>";

    var actions =
      '<div class="report-actions">' +
        '<button class="btn ghost" id="pdf-btn" type="button">Export PDF</button>' +
        '<button class="btn" id="send-btn" type="button">Send to ' + esc(D.sendTo) + "</button>" +
      "</div>";

    return (
      '<section class="card report-head">' +
        '<div class="card-head row"><div><p class="eyebrow">Scope compliance report</p><h1>' + esc(D.deployment.name) + "</h1>" +
        '<p class="muted">' + esc(D.deployment.vendor) + " for " + esc(D.deployment.customer) + " · FDE " + esc(D.deployment.fde) + " · " +
        esc(D.deployment.plannedStart) + " – " + esc(D.deployment.plannedEnd) + "</p></div>" + actions + "</div>" +
        stats +
        '<p class="approval-strip' + (state.approved ? "" : " warn") + '">' + approvalLine + "</p>" +
        '<p class="fine">This report shows whether recorded activity stayed within the approved scope. It does not assess whether the agent\'s replies are correct.</p>' +
      "</section>" +
      '<section class="card">' +
        '<div class="card-head"><h2>Approved scope vs. actual activity</h2></div>' +
        '<div class="table-wrap"><table class="data-table stack-sm">' +
          "<thead><tr><th>ID</th><th>System</th><th>Resource</th><th>Access</th><th>Status</th></tr></thead>" +
          "<tbody>" + rows + "</tbody></table></div>" +
      "</section>" +
      flagCards +
      tamper
    );
  }

  function stat(n, label, tone) {
    return '<div class="stat' + (tone ? " " + tone : "") + '"><span class="stat-n">' + n + '</span><span class="stat-l">' + esc(label) + "</span></div>";
  }

  // ---------- events ----------

  function bind(step) {
    if (step === "scope") {
      var b = document.getElementById("approve-btn");
      if (b) b.onclick = function () {
        state.approved = true;
        render();
        toast("Scope approved by " + D.approval.approver + ", " + D.approval.team);
      };
    }
    if (step === "activity") bindSimButtons();
    if (step === "build") {
      document.querySelectorAll("[data-comp]").forEach(function (el) {
        el.addEventListener("click", function () {
          state.component = el.getAttribute("data-comp");
          document.querySelectorAll(".comp-btn").forEach(function (btn) {
            var on = btn.getAttribute("data-comp") === state.component;
            btn.classList.toggle("active", on);
            btn.setAttribute("aria-selected", on);
          });
          document.getElementById("comp-detail").innerHTML = componentDetail();
          if (el.classList.contains("comp-link")) {
            document.getElementById("components").scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });
    }
    if (step === "report") {
      document.getElementById("pdf-btn").onclick = function () { toast("PDF export is not available in this mockup."); };
      document.getElementById("send-btn").onclick = function () { toast("Report sent to " + D.sendTo + " (simulated)."); };
    }
  }

  function move(delta) {
    var i = STEPS.indexOf(currentStep()) + delta;
    if (i >= 0 && i < STEPS.length) {
      go(STEPS[i]);
      window.scrollTo(0, 0);
    }
  }

  document.getElementById("prev-btn").onclick = function () { move(-1); };
  document.getElementById("next-btn").onclick = function () { move(1); };
  document.getElementById("reset-btn").onclick = function () {
    stopSim();
    state = freshState();
    go("scope");
    toast("Demo reset.");
  };
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.key === "ArrowRight") move(1);
    if (e.key === "ArrowLeft") move(-1);
  });
  window.addEventListener("hashchange", function () { render(); window.scrollTo(0, 0); });

  document.getElementById("deploy-chip").innerHTML =
    esc(D.deployment.vendor) + ' <span aria-hidden="true">→</span> ' + esc(D.deployment.customer);

  render();
})();
