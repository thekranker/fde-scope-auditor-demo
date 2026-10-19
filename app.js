(function () {
  "use strict";

  var D = window.DEMO;
  var C = D.copy;
  var STEPS = ["approve", "watch", "report"];
  var STEP_LABELS = { approve: "Approve", watch: "Watch", report: "Report" };
  // Links from the old four-step version still land somewhere sensible.
  var ALIASES = { scope: "approve", activity: "watch", build: "report" };
  var SIM_INTERVAL_MS = 1000;

  // The live feed and the report both use only the events marked `feed: true`.
  var EVENTS = D.events.filter(function (e) { return e.feed; });

  var state = freshState();

  function freshState() {
    return {
      approved: false,
      shown: 0,          // number of events revealed in the live feed
      running: false,
      pausedOnFlag: false,
      timer: null,
      component: "C1",
      open: {},          // per-row "Details" toggles, keyed by row
      buildOpen: false,
      tamperOpen: false,
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
    return EVENTS.filter(function (e) { return !e.scopeId; });
  }

  function eventsForScope(id) {
    return EVENTS.filter(function (e) { return e.scopeId === id; });
  }

  function recordId(e) {
    return "EVT-7F3A-" + ("000" + (EVENTS.indexOf(e) + 1)).slice(-4);
  }

  function accessBadge(row) {
    return '<span class="badge ' + (row.access === "write" ? "write" : "read") + '">' + esc(row.access) + "</span>";
  }

  function accessText(row) {
    return esc(row.access) + (row.accessNote ? " (" + esc(row.accessNote) + ")" : "");
  }

  function classBadge(c) {
    var k = /PII/.test(c) ? "pii" : /Confidential|Financial/.test(c) ? "conf" : "internal";
    return '<span class="badge cls-' + k + '">' + esc(c) + "</span>";
  }

  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

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
    return EVENTS.map(function (e) {
      var id = recordId(e);
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

  // ---------- shared pieces ----------

  function hero(title, sub, extra) {
    return (
      '<section class="hero">' +
        "<h1>" + esc(title) + "</h1>" +
        '<p class="hero-sub">' + esc(sub) + "</p>" +
        (extra || "") +
      "</section>"
    );
  }

  function detailsBtn(key) {
    var open = !!state.open[key];
    return (
      '<button type="button" class="details-btn" data-toggle="' + key + '" aria-expanded="' + open +
      '" aria-controls="d-' + key + '">' + (open ? "Hide details" : "Details") + "</button>"
    );
  }

  // rows: [[label, html], ...]
  function detailsPanel(key, rows) {
    return (
      '<dl class="item-details" id="d-' + key + '"' + (state.open[key] ? "" : " hidden") + ">" +
        rows.map(function (r) { return "<div><dt>" + esc(r[0]) + "</dt><dd>" + r[1] + "</dd></div>"; }).join("") +
      "</dl>"
    );
  }

  // ---------- routing ----------

  function currentStep() {
    var h = (location.hash || "").replace("#", "");
    if (ALIASES[h]) return ALIASES[h];
    return STEPS.indexOf(h) >= 0 ? h : "approve";
  }

  function go(step) {
    if (location.hash !== "#" + step) location.hash = step;
    else render();
  }

  function render() {
    var raw = (location.hash || "").replace("#", "");
    if (ALIASES[raw]) {
      if (raw === "build") state.buildOpen = true;
      history.replaceState(null, "", "#" + ALIASES[raw]);
    }
    var step = currentStep();
    if (step !== "watch") stopSim();

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
    next.innerHTML = idx < STEPS.length - 1 ? "Next: " + STEP_LABELS[STEPS[idx + 1]] + " &rarr;" : "Next &rarr;";

    var app = document.getElementById("app");
    app.innerHTML = { approve: viewApprove, watch: viewWatch, report: viewReport }[step]();
    bind(step);
  }

  // ---------- 1. Approve ----------

  function statusBlock() {
    if (state.approved) {
      return (
        '<div class="status-block">' +
          '<span class="badge status ok">Approved</span>' +
          '<p class="approval-line">Approved by ' + esc(D.approval.approver) + ", " + esc(D.approval.team) +
          '<br><span class="muted">' + esc(D.approval.timestamp) + "</span></p>" +
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

  function scopeItem(r) {
    var key = "scope-" + r.id;
    return (
      '<li class="item">' +
        '<div class="item-main"><span class="item-label">' + esc(r.plainLabel) + '</span><span class="item-sub">' + esc(r.system) + "</span></div>" +
        '<div class="item-tags">' + accessBadge(r) + classBadge(r.classification) + "</div>" +
        detailsBtn(key) +
        detailsPanel(key, [
          ["Endpoint or resource", "<code>" + esc(r.resource) + "</code>"],
          ["Access", accessText(r)],
          ["Why it's needed", esc(r.reason)],
          ["Scope ID", esc(r.id)],
        ]) +
      "</li>"
    );
  }

  function viewApprove() {
    var d = D.deployment;
    var generated =
      '<p class="hero-note">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 3h7l5 5v13H7z M14 3v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>' +
        esc(C.approve.generated) +
      "</p>";
    return (
      hero(C.approve.headline, C.approve.subline, generated) +
      '<section class="card">' +
        '<div class="card-head row">' +
          '<div><p class="eyebrow">Deployment ' + esc(d.id) + "</p><h2>" + esc(d.name) + "</h2>" +
          '<p class="muted">' + esc(d.vendor) + " for " + esc(d.customer) + " · FDE " + esc(d.fde) + " · " +
          esc(d.plannedStart) + " – " + esc(d.plannedEnd) + "</p></div>" +
          statusBlock() +
        "</div>" +
        '<p class="list-caption">' + plural(D.scope.length, "item") + " requested by " + esc(d.vendor) + "</p>" +
        '<ul class="items">' + D.scope.map(scopeItem).join("") + "</ul>" +
      "</section>"
    );
  }

  // ---------- 2. Watch ----------

  function eventItem(e, i, isNew) {
    var oos = !e.scopeId;
    var key = "ev-" + i;
    var badge = oos ? '<span class="badge oos">Outside scope</span>' : '<span class="badge ins">In scope</span>';
    var match = oos ? "None. Not on the approved list." : esc(e.scopeId) + " · " + esc(scopeById(e.scopeId).plainLabel);
    return (
      '<li class="item event' + (oos ? " is-oos" : "") + (isNew ? " is-new" : "") + '">' +
        '<div class="ev-time">' + esc(e.ts) + "</div>" +
        '<div class="item-main"><span class="item-label">' + esc(e.plainLabel) + "</span>" +
        '<span class="item-sub"><span class="actor-dot ' + e.actor + '"></span>' + esc(D.actors[e.actor]) + " · " + esc(e.system) + "</span></div>" +
        '<div class="item-tags">' + badge + "</div>" +
        detailsBtn(key) +
        (oos ? '<p class="flag-note"><strong>Not on the approved list.</strong> ' + esc(e.flag.short) + "</p>" : "") +
        detailsPanel(key, [
          ["Action", "<code>" + esc(e.action) + "</code>"],
          ["Record source", esc(e.source)],
          ["Matches approved item", match],
        ]) +
      "</li>"
    );
  }

  function feedItems(newIndex) {
    if (!state.shown) {
      return '<li class="empty">No actions yet. Click <strong>Start simulation</strong> to replay the deployment week.</li>';
    }
    // newest first so the latest event stays visible on a shared screen
    return EVENTS.slice(0, state.shown).map(function (e, i) { return eventItem(e, i, i === newIndex); }).reverse().join("");
  }

  function feedCounts() {
    var oos = EVENTS.slice(0, state.shown).filter(function (e) { return !e.scopeId; }).length;
    return (
      '<span class="count"><strong>' + state.shown + "</strong> of " + EVENTS.length + " actions checked</span>" +
      '<span class="count ' + (oos ? "bad" : "") + '"><strong>' + oos + "</strong> outside scope</span>"
    );
  }

  function simButtons() {
    var done = state.shown >= EVENTS.length;
    var label = state.running ? "Pause" : state.shown === 0 ? "Start simulation" : done ? "Replay" : "Resume";
    return (
      '<button class="btn" id="sim-btn" type="button">' + label + "</button>" +
      '<button class="btn ghost" id="showall-btn" type="button"' + (done ? " disabled" : "") + ">Show all</button>" +
      '<button class="btn ghost" id="clear-btn" type="button"' + (state.shown === 0 ? " disabled" : "") + ">Clear</button>"
    );
  }

  function pausedNote() {
    return state.pausedOnFlag
      ? '<div class="alert bad" id="paused-note"><strong>Outside-scope action detected.</strong> The simulation paused so you can look at it. Click Resume to continue.</div>'
      : "";
  }

  function viewWatch() {
    var notApproved = state.approved
      ? ""
      : '<div class="alert warn">Scope hasn\'t been approved yet. Actions are being checked against the <a href="#approve">requested list</a>.</div>';
    return (
      hero(C.watch.headline, C.watch.subline) +
      '<section class="card">' +
        '<div class="feed-bar">' +
          '<div class="feed-counts" id="feed-counts">' + feedCounts() + "</div>" +
          '<div class="sim-controls" id="sim-controls">' + simButtons() + "</div>" +
        "</div>" +
        notApproved +
        '<div id="paused-wrap">' + pausedNote() + "</div>" +
        '<ol class="items feed" id="feed">' + feedItems(-1) + "</ol>" +
        '<p class="fine source-note">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>' +
          esc(C.watch.sources) +
        "</p>" +
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
    if (state.shown >= EVENTS.length) { stopSim(); refreshFeed(-1); return; }
    var e = EVENTS[state.shown];
    state.shown++;
    if (!e.scopeId) {
      stopSim();
      state.pausedOnFlag = true;
    }
    if (state.shown >= EVENTS.length) stopSim();
    refreshFeed(state.shown - 1);
  }

  function startSim() {
    if (state.shown >= EVENTS.length) state.shown = 0;
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
      state.shown = EVENTS.length;
      refreshFeed(-1);
    };
    document.getElementById("clear-btn").onclick = function () {
      stopSim();
      state.pausedOnFlag = false;
      state.shown = 0;
      refreshFeed(-1);
    };
  }

  // ---------- 3. Report ----------

  function issueCard(flags) {
    if (!flags.length) return "";
    var issues = flags.map(function (e, i) {
      var comp = componentById(e.component);
      var key = "issue-" + i;
      return (
        '<div class="issue">' +
          '<h2 class="issue-title">' + esc(e.plainLabel) + "</h2>" +
          '<dl class="issue-facts">' +
            "<div><dt>What happened</dt><dd>" + esc(e.flag.explanation) + "</dd></div>" +
            "<div><dt>When</dt><dd>" + esc(e.ts) + " ET · " + esc(D.actors[e.actor]) + "</dd></div>" +
            '<div class="next"><dt>Suggested next step</dt><dd><strong>' + esc(e.flag.nextStep) + "</strong>" +
            '<span class="muted">' + esc(e.flag.nextDetail) + "</span></dd></div>" +
          "</dl>" +
          detailsBtn(key) +
          detailsPanel(key, [
            ["Call", "<code>" + esc(e.action) + "</code>"],
            ["Record source", esc(e.source) + " (customer-owned, read-only)"],
            ["Data involved", classBadge(e.flag.dataClass)],
            ["Made by", esc(comp.name)],
            ["Record ID", '<span class="mono">' + recordId(e) + "</span>"],
          ]) +
        "</div>"
      );
    }).join("");
    return (
      '<section class="card issue-card">' +
        '<div class="issue-head"><span class="issue-count">' + plural(flags.length, "issue") + " found</span>" +
        '<span class="badge oos">Outside scope</span></div>' +
        issues +
      "</section>"
    );
  }

  function reportItem(r) {
    var evs = eventsForScope(r.id);
    var key = "rep-" + r.id;
    var status = evs.length
      ? '<span class="badge ins">Used</span><span class="muted tag-note">' + plural(evs.length, "time") + "</span>"
      : '<span class="badge neutral">Not used</span>';
    var activity = evs.length
      ? "<ul class=\"plain-list\">" + evs.map(function (e) { return "<li>" + esc(e.ts) + " · " + esc(e.plainLabel) + "</li>"; }).join("") + "</ul>"
      : "None recorded. Consider removing this access.";
    return (
      '<li class="item">' +
        '<div class="item-main"><span class="item-label">' + esc(r.plainLabel) + '</span><span class="item-sub">' + esc(r.system) + "</span></div>" +
        '<div class="item-tags">' + status + "</div>" +
        detailsBtn(key) +
        detailsPanel(key, [
          ["Endpoint or resource", "<code>" + esc(r.resource) + "</code>"],
          ["Access", accessText(r)],
          ["Recorded activity", activity],
        ]) +
      "</li>"
    );
  }

  function reportOosItem(e, i) {
    var key = "rep-oos-" + i;
    return (
      '<li class="item is-oos">' +
        '<div class="item-main"><span class="item-label">' + esc(e.plainLabel) + '</span><span class="item-sub">' + esc(e.system) + "</span></div>" +
        '<div class="item-tags"><span class="badge oos">Not approved</span><span class="muted tag-note">1 time</span></div>' +
        detailsBtn(key) +
        detailsPanel(key, [
          ["Action", "<code>" + esc(e.action) + "</code>"],
          ["When", esc(e.ts) + " ET"],
          ["Record source", esc(e.source)],
        ]) +
      "</li>"
    );
  }

  function stat(n, label, tone) {
    return '<div class="stat' + (tone ? " " + tone : "") + '"><span class="stat-n">' + n + '</span><span class="stat-l">' + esc(label) + "</span></div>";
  }

  function fold(id, open, title, sub, badge, body) {
    return (
      '<details class="fold" id="' + id + '"' + (open ? " open" : "") + ">" +
        "<summary>" +
          '<span class="fold-text"><span class="fold-title">' + esc(title) + '</span><span class="fold-sub">' + esc(sub) + "</span></span>" +
          (badge || "") +
          '<span class="fold-chev" aria-hidden="true"></span>' +
        "</summary>" +
        '<div class="fold-body">' + body + "</div>" +
      "</details>"
    );
  }

  function viewReport() {
    var flags = flaggedEvents();
    var used = D.scope.filter(function (r) { return eventsForScope(r.id).length > 0; });
    var headline = flags.length
      ? plural(flags.length, "action") + " went outside the approved scope."
      : "Every action stayed within the approved scope.";
    var approvalLine = state.approved
      ? "Approved scope: signed off by " + esc(D.approval.approver) + ", " + esc(D.approval.team) + " on " + esc(D.approval.timestamp) + "."
      : 'Scope not yet approved in this demo. <a href="#approve">Approve it on step 1</a>.';

    var shared =
      '<div class="shared-note">' +
        "<p>" + esc(C.report.shared) + "</p>" +
        '<div class="report-actions">' +
          '<button class="btn ghost" id="pdf-btn" type="button">Export PDF</button>' +
          '<button class="btn" id="send-btn" type="button">Send to ' + esc(D.sendTo) + "</button>" +
        "</div>" +
      "</div>";

    var summary =
      '<section class="card">' +
        '<div class="stats">' +
          stat(D.scope.length, "Approved items") +
          stat(used.length, "Items used") +
          stat(EVENTS.length, "Actions recorded") +
          stat(flags.length, "Outside scope", flags.length ? "bad" : "ok") +
        "</div>" +
        '<p class="approval-strip' + (state.approved ? "" : " warn") + '">' + approvalLine + "</p>" +
        '<p class="fine">' + esc(C.report.disclaimer) + "</p>" +
      "</section>";

    var compare =
      '<section class="card">' +
        '<div class="card-head"><h2>Approved list vs. what actually happened</h2></div>' +
        '<ul class="items">' + D.scope.map(reportItem).join("") + flags.map(reportOosItem).join("") + "</ul>" +
      "</section>";

    var flaggedChanges = 0;
    D.phases.forEach(function (p) { p.changes.forEach(function (c) { if (c.flagged) flaggedChanges++; }); });
    var build = fold(
      "build", state.buildOpen, "See how it was built",
      "Timeline, components and data flow, reconstructed from the recorded activity.",
      flaggedChanges ? '<span class="badge oos small">' + plural(flaggedChanges, "flagged change") + "</span>" : "",
      viewBuild()
    );

    var chain = hashChain();
    var tamper = fold(
      "tamper", state.tamperOpen, "Tamper-evident record",
      "Each record includes the hash of the one before it, so editing or deleting any record breaks the chain.",
      '<span class="badge ins small">Chain intact · ' + chain.length + " records</span>",
      tamperBody(chain)
    );

    return (
      hero(headline, flags.length ? C.report.subline : C.report.sublineClean, shared) +
      issueCard(flags) +
      summary +
      compare +
      build +
      tamper
    );
  }

  function tamperBody(chain) {
    var tail = chain.slice(-5).reverse();
    return (
      '<section class="card">' +
        '<div class="chain">' +
          tail.map(function (r) {
            return (
              '<div class="chain-rec' + (r.event.scopeId ? "" : " is-oos") + '">' +
                '<div class="chain-id mono">' + r.id + "</div>" +
                '<div class="chain-hash"><span class="muted">prev</span> <code>' + short(r.prev) + "</code></div>" +
                '<div class="chain-hash"><span class="muted">hash</span> <code>' + short(r.hash) + "</code></div>" +
                '<div class="chain-what muted">' + esc(r.event.ts) + " · " + esc(r.event.system) + "</div>" +
              "</div>"
            );
          }).join("") +
        "</div>" +
        '<p class="fine">Showing the 5 most recent records. Chain head: <code>' + chain[chain.length - 1].hash + "</code>. Illustrative only.</p>" +
      "</section>"
    );
  }

  // ---------- How it was built (inside the report) ----------

  function viewBuild() {
    var summary =
      '<section class="card summary-card">' +
        '<p class="eyebrow">Plain-language summary</p>' +
        "<h2>What " + esc(D.deployment.fde) + " built for " + esc(D.deployment.customer) + "</h2>" +
        D.buildSummary.map(function (p, i) {
          return "<p" + (i === D.buildSummary.length - 1 ? ' class="summary-flag"' : "") + ">" + esc(p) + "</p>";
        }).join("") +
        '<p class="fine">Reconstructed from ' + EVENTS.length + " recorded actions and the vendor's change history. Describes what was built and touched, not whether the agent's replies are correct.</p>" +
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
                        (c.flagged ? ' <span class="badge oos">Outside scope</span>' : "") + "</li>"
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
                  (bad ? '<span class="badge oos small">1 outside scope</span>' : "") +
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
    var evCount = EVENTS.filter(function (e) { return e.component === c.id; }).length;
    var scopeRows = c.scopeIds.length
      ? '<ul class="scope-links">' + c.scopeIds.map(function (id) {
          var r = scopeById(id);
          return (
            '<li><span class="mono id-pill">' + id + "</span><div><strong>" + esc(r.plainLabel) + "</strong> · " + esc(r.system) +
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
        "<div><dt>Recorded actions</dt><dd>" + evCount + "</dd></div>" +
      "</dl>" +
      "<h4>Linked scope rows</h4>" + scopeRows + oos
    );
  }

  function dataFlow() {
    var arrow = '<div class="flow-arrow" aria-hidden="true"><svg viewBox="0 0 40 16"><path d="M0 8h34M28 2l7 6-7 6" fill="none" stroke="currentColor" stroke-width="2"/></svg></div>';
    var nodes = D.dataFlow.map(function (n) {
      var branch = n.id === "f3"
        ? '<div class="flow-branch"><span class="branch-line" aria-hidden="true"></span><div class="flow-node oos-node"><strong>BillingAccount</strong><span>Read once on Fri 9 Oct</span><span class="badge oos small">Outside scope</span></div></div>'
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

  // ---------- events ----------

  function bind(step) {
    if (step === "approve") {
      var b = document.getElementById("approve-btn");
      if (b) b.onclick = function () {
        state.approved = true;
        render();
        toast("Scope approved by " + D.approval.approver + ", " + D.approval.team);
      };
    }
    if (step === "watch") bindSimButtons();
    if (step === "report") {
      document.getElementById("pdf-btn").onclick = function () { toast("PDF export is not available in this mockup."); };
      document.getElementById("send-btn").onclick = function () { toast("Report sent to " + D.sendTo + " (simulated)."); };
      document.getElementById("build").addEventListener("toggle", function () { state.buildOpen = this.open; });
      document.getElementById("tamper").addEventListener("toggle", function () { state.tamperOpen = this.open; });
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
  }

  // "Details" toggles on any row, on any screen.
  document.getElementById("app").addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-toggle]");
    if (!btn) return;
    var key = btn.getAttribute("data-toggle");
    var open = !state.open[key];
    state.open[key] = open;
    btn.setAttribute("aria-expanded", open);
    btn.textContent = open ? "Hide details" : "Details";
    var panel = document.getElementById("d-" + key);
    if (panel) panel.hidden = !open;
  });

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
    go("approve");
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
