import { watchAuth, signIn, logOut, subscribeData, pushData } from "./firebase-init.js";

(function () {
  "use strict";

  var STORAGE_KEY = "logbook-v1";
  var WEEKDAY_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var DEFAULT_SPLIT = { 1:"Push", 2:"Pull", 3:"Legs", 4:"Rest", 5:"Push", 6:"Pull", 0:"Legs / Walk" };
  var SPLIT_OPTIONS = ["Push","Pull","Legs","Upper","Lower","Full Body","Cardio","Rest","Legs / Walk"];

  var ICON_CHECK =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  var ICON_X =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  var ICON_LEFT =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  var ICON_RIGHT =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  var ICON_PLUS =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  var ICON_FLAME =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>';
  var ICON_MOON =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  var ICON_DUMBBELL =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5 17.5 17.5"></path><path d="m21 21-1-1"></path><path d="m3 3 1 1"></path><path d="m18 22 4-4"></path><path d="m2 6 4-4"></path><path d="m3 10 7-7"></path><path d="m14 21 7-7"></path></svg>';
  var ICON_CAL =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';

  // ---------- date helpers ----------
  function pad(n) { return String(n).padStart(2, "0"); }
  function toKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fromKey(k) { var p = k.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function isSameDay(a, b) { return toKey(a) === toKey(b); }
  function uid() { return Math.random().toString(36).slice(2, 9); }

  function timeToMinutes(t) {
    if (!t) return null;
    var p = t.split(":").map(Number);
    return p[0] * 60 + p[1];
  }
  function sleepHours(bed, wake) {
    var b = timeToMinutes(bed), w = timeToMinutes(wake);
    if (b == null || w == null) return null;
    var diff = w - b;
    if (diff <= 0) diff += 24 * 60;
    return Math.round((diff / 60) * 10) / 10;
  }

  function emptyDay() { return { completions: {}, sleep: { bed: "", wake: "" }, exercises: [], note: "" }; }

  // ---------- state ----------
  var state = { habits: [], split: Object.assign({}, DEFAULT_SPLIT), days: {} };
  var today = new Date();
  var selected = new Date();
  var currentUser = null;
  var authReady = false;
  var unsubscribeData = null;
  var applyingRemote = false;

  function loadLocalFallback() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY + "-guest");
      if (raw) {
        var parsed = JSON.parse(raw);
        state.habits = parsed.habits || [];
        state.split = parsed.split || Object.assign({}, DEFAULT_SPLIT);
        state.days = parsed.days || {};
      }
    } catch (e) { console.warn("could not load local data", e); }
  }

  var saveTimer = null;
  function save() {
    if (applyingRemote) return; // don't echo back a change we just received
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (currentUser) {
        pushData(currentUser.uid, state).catch(function (e) { console.error("sync failed", e); });
      } else {
        try { localStorage.setItem(STORAGE_KEY + "-guest", JSON.stringify(state)); }
        catch (e) { console.warn("could not save local data", e); }
      }
    }, 250);
  }

  function getDay(key) { return state.days[key] || emptyDay(); }
  function updateDay(key, patch) {
    var cur = Object.assign({}, emptyDay(), state.days[key]);
    state.days[key] = Object.assign(cur, patch);
    save();
  }
  function ensureSeeded(key, date) {
    if (state.days[key]) return;
    var wd = date.getDay();
    var splitName = state.split[wd] || "Rest";
    var seed = /rest/i.test(splitName) ? [] : [];
    state.days[key] = Object.assign(emptyDay(), { exercises: seed });
    save();
  }

  // ---------- derived ----------
  function completionFor(key) {
    var d = state.days[key];
    if (!d) return null;
    var totalHabits = state.habits.length;
    var doneHabits = state.habits.filter(function (h) { return d.completions && d.completions[h.id]; }).length;
    var ex = d.exercises || [];
    var totalEx = ex.filter(function (e) { return e.name; }).length;
    var doneEx = ex.filter(function (e) { return e.name && e.done; }).length;
    var totalUnits = totalHabits + totalEx;
    if (totalUnits === 0) return null;
    return (doneHabits + doneEx) / totalUnits;
  }

  function computeStreak() {
    var count = 0, cursor = new Date(today);
    for (var i = 0; i < 400; i++) {
      var k = toKey(cursor);
      var p = completionFor(k);
      if (p != null && p > 0) { count++; cursor = addDays(cursor, -1); } else break;
    }
    return count;
  }

  function computeHeatmap() {
    var endOfWeek = addDays(today, 6 - today.getDay());
    var cells = [];
    for (var w = 11; w >= 0; w--) {
      var weekStart = addDays(endOfWeek, -7 * w - 6);
      var col = [];
      for (var d = 0; d < 7; d++) {
        var date = addDays(weekStart, d);
        if (date > today) col.push({ k: toKey(date), pct: null, future: true });
        else col.push({ k: toKey(date), pct: completionFor(toKey(date)), future: false });
      }
      cells.push(col);
    }
    return cells;
  }

  function heatColor(cell) {
    if (cell.future) return "transparent";
    if (cell.pct == null) return "#0d0d0d";
    if (cell.pct === 0) return "#1F1F1F";
    if (cell.pct < 0.34) return "#3D3D3D";
    if (cell.pct < 0.67) return "#6B6B6B";
    if (cell.pct < 1) return "#ABABAB";
    return "#FFFFFF";
  }

  function computeSleepTrend() {
    var arr = [];
    for (var i = 13; i >= 0; i--) {
      var date = addDays(today, -i);
      var k = toKey(date);
      var d = state.days[k];
      var hrs = d ? sleepHours(d.sleep && d.sleep.bed, d.sleep && d.sleep.wake) : null;
      arr.push({ label: MONTH_SHORT[date.getMonth()] + " " + date.getDate(), hours: hrs });
    }
    return arr;
  }

  // simple inline SVG line chart, no dependencies
  function renderSleepChart(data) {
    var points = data
      .map(function (pt, i) { return { i: i, pt: pt }; })
      .filter(function (o) { return o.pt.hours != null; });

    if (points.length === 0) {
      return '<div class="chart-empty">log bedtime &amp; wake time to see your 14‑day sleep trend</div>';
    }

    var w = 600, h = 220, padL = 34, padR = 14, padT = 16, padB = 28;
    var values = points.map(function (o) { return o.pt.hours; });
    var rawMin = Math.min.apply(null, values);
    var rawMax = Math.max.apply(null, values);
    var minH = Math.max(0, Math.floor(rawMin) - 1);
    var maxH = Math.min(14, Math.ceil(rawMax) + 1);
    if (maxH - minH < 3) { maxH = minH + 3; } // avoid an overly flat line for narrow ranges
    var range = maxH - minH;

    var xStep = (w - padL - padR) / Math.max(1, data.length - 1);
    var xy = points.map(function (o) {
      var x = padL + o.i * xStep;
      var y = padT + (1 - (o.pt.hours - minH) / range) * (h - padT - padB);
      return { x: x, y: y, pt: o.pt };
    });

    var pathD = xy.map(function (p, i) { return (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1); }).join(" ");
    var areaD = pathD +
      " L " + xy[xy.length - 1].x.toFixed(1) + " " + (h - padB) +
      " L " + xy[0].x.toFixed(1) + " " + (h - padB) + " Z";

    var gridVals = [];
    var stepCount = 4;
    for (var g = 0; g <= stepCount; g++) gridVals.push(minH + (range / stepCount) * g);
    var gridLines = gridVals.map(function (v) {
      var y = padT + (1 - (v - minH) / range) * (h - padT - padB);
      return (
        '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + y.toFixed(1) + '" stroke="#232323" stroke-width="1"/>' +
        '<text x="' + (padL - 8) + '" y="' + (y + 3).toFixed(1) + '" font-size="10" fill="#666666" text-anchor="end" font-family="JetBrains Mono, monospace">' + Math.round(v) + "h</text>"
      );
    }).join("");

    var dots = xy.map(function (p) {
      return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.4" fill="#000000" stroke="#FFFFFF" stroke-width="2"><title>' + p.pt.label + ": " + p.pt.hours + "h</title></circle>";
    }).join("");

    var labelEvery = Math.ceil(data.length / 6);
    var labels = data.map(function (pt, i) {
      if (i % labelEvery !== 0) return "";
      var x = padL + i * xStep;
      return '<text x="' + x.toFixed(1) + '" y="' + (h - 6) + '" font-size="10" fill="#666666" text-anchor="middle" font-family="JetBrains Mono, monospace">' + pt.label + "</text>";
    }).join("");

    return (
      '<svg viewBox="0 0 ' + w + " " + h + '" width="100%" height="180" preserveAspectRatio="xMidYMid meet">' +
      '<defs><linearGradient id="sleepFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.16"/>' +
      '<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>' +
      "</linearGradient></defs>" +
      gridLines +
      '<path d="' + areaD + '" fill="url(#sleepFill)" stroke="none"/>' +
      '<path d="' + pathD + '" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>' +
      dots + labels +
      "</svg>"
    );
  }

  // ---------- render ----------
  var $app = document.getElementById("app");

  function renderLoginScreen() {
    $app.innerHTML =
      '<div class="login-screen">' +
        '<div class="login-caption">CHENNAI, INDIA · LOGBOOK</div>' +
        '<div class="login-title">Sign in<br/>to sync.</div>' +
        '<div class="login-sub">Your habits, sleep &amp; notes, kept in sync across your phone, tablet and laptop.</div>' +
        '<button class="btn btn-solid" id="google-signin-btn">Sign in with Google</button>' +
        '<button class="login-guest" id="guest-btn">Continue without an account</button>' +
      "</div>";
    document.getElementById("google-signin-btn").addEventListener("click", function () {
      signIn().catch(function (e) { console.error(e); alert("Sign-in failed: " + e.message); });
    });
    document.getElementById("guest-btn").addEventListener("click", function () {
      currentUser = "guest";
      loadLocalFallback();
      render();
    });
  }

  function render() {
    if (currentUser === null && !authReady) {
      $app.innerHTML = '<div class="loading-screen">checking sign-in…</div>';
      return;
    }
    if (currentUser === null) {
      renderLoginScreen();
      return;
    }
    var key = toKey(selected);
    ensureSeeded(key, selected);
    var dayData = getDay(key);
    var weekday = selected.getDay();
    var splitName = state.split[weekday] || "Rest";
    var isToday = isSameDay(selected, today);
    var isFuture = selected > today && !isToday;

    var pctRaw = completionFor(key);
    var pct = pctRaw == null ? 0 : Math.round(pctRaw * 100);
    var ringCirc = 2 * Math.PI * 42;
    var ringOffset = ringCirc - (pct / 100) * ringCirc;
    var streak = computeStreak();
    var heatmap = computeHeatmap();
    var sleepTrend = computeSleepTrend();
    var hrs = sleepHours(dayData.sleep.bed, dayData.sleep.wake);

    var habitsHtml = state.habits.length === 0
      ? '<p class="empty-msg">no tasks yet — add one below</p>'
      : state.habits.map(function (h) {
          var done = !!dayData.completions[h.id];
          return (
            '<div class="item-row" data-habit="' + h.id + '">' +
              '<button class="checkbox ' + (done ? "checked" : "") + '" data-action="toggle-habit" data-id="' + h.id + '">' + ICON_CHECK + "</button>" +
              '<span class="item-text ' + (done ? "done" : "") + '">' + escapeHtml(h.name) + "</span>" +
              '<button class="item-del" data-action="del-habit" data-id="' + h.id + '">' + ICON_X + "</button>" +
            "</div>"
          );
        }).join("");

    var exHtml = dayData.exercises.length === 0
      ? '<p class="empty-msg">' + (/rest/i.test(splitName) ? "rest day — recover well" : "no exercises logged yet") + "</p>"
      : dayData.exercises.map(function (ex) {
          return (
            '<div class="item-row">' +
              '<button class="checkbox circle ' + (ex.done ? "checked" : "") + '" data-action="toggle-ex" data-id="' + ex.id + '">' + ICON_CHECK + "</button>" +
              '<span class="item-text ' + (ex.done ? "done" : "") + '">' + escapeHtml(ex.name) + "</span>" +
              '<button class="item-del" data-action="del-ex" data-id="' + ex.id + '">' + ICON_X + "</button>" +
            "</div>"
          );
        }).join("");

    var splitOptionsHtml = SPLIT_OPTIONS.map(function (opt) {
      return '<option value="' + opt + '" ' + (opt === splitName ? "selected" : "") + ">" + opt + "</option>";
    }).join("");

    var heatmapHtml = heatmap.map(function (col) {
      var cellsHtml = col.map(function (cell) {
        var cls = "heat-cell" + (cell.future ? " future" : "") + (cell.k === key ? " selected" : "");
        return '<button class="' + cls + '" style="background:' + heatColor(cell) + '" data-action="' + (cell.future ? "" : "goto-date") + '" data-key="' + cell.k + '" title="' + cell.k + (cell.pct != null ? " — " + Math.round(cell.pct * 100) + "%" : "") + '"></button>';
      }).join("");
      return '<div class="heat-col">' + cellsHtml + "</div>";
    }).join("");

    $app.innerHTML =
      '<div class="shell">' +
        '<header class="top"><div class="top-inner">' +
          '<div class="brand">' +
            '<span class="brand-mark font-mono">//</span>' +
            '<span class="brand-name font-mono">nithin&nbsp;·&nbsp;logbook</span>' +
          "</div>" +
          '<div class="header-right">' +
          '<div class="streak-pill">' + ICON_FLAME + " " + streak + " day" + (streak === 1 ? "" : "s") + "</div>" +
          (currentUser && currentUser !== "guest"
            ? '<button class="account-pill" id="signout-btn" title="Sign out">' + (currentUser.email || "account") + "</button>"
            : currentUser === "guest"
              ? '<button class="account-pill" id="signin-from-guest-btn">sign in to sync</button>'
              : "") +
          "</div>" +
        "</div></header>" +

        '<main>' +
          '<div class="datenav">' +
            '<button class="nav-btn" data-action="prev-day">' + ICON_LEFT + "</button>" +
            '<div class="date-center">' +
              '<div class="date-caption">' + MONTH_SHORT[selected.getMonth()] + " " + selected.getDate() + ", " + selected.getFullYear() + (isToday ? " · TODAY" : "") + "</div>" +
              '<div class="date-weekday">' + WEEKDAY_LONG[weekday] + "</div>" +
              (isToday ? "" : '<button class="jump-today" data-action="jump-today">' + ICON_CAL + " jump to today</button>") +
            "</div>" +
            '<button class="nav-btn" data-action="next-day">' + ICON_RIGHT + "</button>" +
          "</div>" +

          '<div class="grid">' +
            '<div class="col">' +
              '<section class="card">' +
                '<div class="card-head"><h2 class="card-title">tasks</h2>' +
                  '<span class="card-count">' + state.habits.filter(function (h) { return dayData.completions[h.id]; }).length + "/" + state.habits.length + "</span>" +
                "</div>" +
                '<div>' + habitsHtml + "</div>" +
                '<div class="input-row">' +
                  '<input class="text-input" id="new-habit-input" placeholder="add a daily task…" />' +
                  '<button class="add-btn" data-action="add-habit">' + ICON_PLUS + "</button>" +
                "</div>" +
              "</section>" +

              '<section class="card">' +
                '<div class="card-head">' +
                  '<h2 class="card-title">workout · ' + splitName.toLowerCase() + "</h2>" +
                  '<select class="split-select" id="split-select">' + splitOptionsHtml + "</select>" +
                "</div>" +
                '<div>' + exHtml + "</div>" +
                '<div class="input-row">' +
                  '<input class="text-input" id="new-ex-input" placeholder="e.g. pull-ups 4x8…" />' +
                  '<button class="add-btn" data-action="add-ex">' + ICON_PLUS + "</button>" +
                "</div>" +
              "</section>" +

              '<section class="card">' +
                '<h2 class="card-title" style="margin-bottom:14px">notes</h2>' +
                '<textarea class="note-input" id="note-input" placeholder="what happened today…">' + escapeHtml(dayData.note) + "</textarea>" +
              "</section>" +
            "</div>" +

            '<div class="col">' +
              '<section class="card ring-card">' +
                '<div class="ring-wrap"><svg width="88" height="88" viewBox="0 0 96 96">' +
                  '<circle cx="48" cy="48" r="42" fill="none" stroke="#1F1F1F" stroke-width="7"/>' +
                  '<circle cx="48" cy="48" r="42" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + ringCirc + '" stroke-dashoffset="' + ringOffset + '" style="transition:stroke-dashoffset .4s ease"/>' +
                "</svg><div class=\"ring-pct\">" + pct + "%</div></div>" +
                '<div>' +
                  '<div class="ring-label-title">' + (isFuture ? "Upcoming" : isToday ? "Today's progress" : "That day's progress") + "</div>" +
                  '<div class="ring-label-sub">tasks + workout combined</div>' +
                "</div>" +
              "</section>" +

              '<section class="card">' +
                '<h2 class="card-title" style="margin-bottom:14px">sleep</h2>' +
                '<div class="time-row">' +
                  '<div class="time-field"><label>bedtime</label><input type="time" id="sleep-bed" value="' + (dayData.sleep.bed || "") + '"/></div>' +
                  '<div class="time-field"><label>wake</label><input type="time" id="sleep-wake" value="' + (dayData.sleep.wake || "") + '"/></div>' +
                "</div>" +
                (hrs != null ? '<div class="sleep-hours">' + hrs + "h slept</div>" : "") +
                '<div class="chart-wrap">' + renderSleepChart(sleepTrend) + "</div>" +
              "</section>" +

              '<section class="card">' +
                '<h2 class="card-title" style="margin-bottom:14px">activity · 12 weeks</h2>' +
                '<div class="heatmap-scroll"><div class="heatmap">' + heatmapHtml + "</div></div>" +
                '<div class="heat-legend">less' +
                  '<span class="heat-cell" style="background:#0d0d0d"></span>' +
                  '<span class="heat-cell" style="background:#1F1F1F"></span>' +
                  '<span class="heat-cell" style="background:#3D3D3D"></span>' +
                  '<span class="heat-cell" style="background:#6B6B6B"></span>' +
                  '<span class="heat-cell" style="background:#ABABAB"></span>' +
                  '<span class="heat-cell" style="background:#FFFFFF"></span>more' +
                "</div>" +
              "</section>" +
            "</div>" +
          "</div>" +
        "</main>" +

        '<footer class="bottom"><p>saved locally on this device · works offline · installable to home screen</p></footer>' +
      "</div>";

    attachListeners(key);
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function attachListeners(key) {
    var signoutBtn = document.getElementById("signout-btn");
    if (signoutBtn) signoutBtn.addEventListener("click", function () {
      if (confirm("Sign out? Your data stays saved in the cloud.")) logOut();
    });
    var signinFromGuest = document.getElementById("signin-from-guest-btn");
    if (signinFromGuest) signinFromGuest.addEventListener("click", function () {
      currentUser = null;
      authReady = false;
      render();
      signIn().catch(function (e) { console.error(e); alert("Sign-in failed: " + e.message); });
    });

    $app.querySelectorAll("[data-action]").forEach(function (el) {
      var action = el.getAttribute("data-action");
      if (!action) return;
      el.addEventListener("click", function () {
        var id = el.getAttribute("data-id");
        var dayData;
        switch (action) {
          case "prev-day": selected = addDays(selected, -1); render(); break;
          case "next-day": selected = addDays(selected, 1); render(); break;
          case "jump-today": selected = new Date(); render(); break;
          case "goto-date": selected = fromKey(el.getAttribute("data-key")); render(); break;
          case "toggle-habit":
            dayData = getDay(key);
            var comp = Object.assign({}, dayData.completions);
            comp[id] = !comp[id];
            updateDay(key, { completions: comp });
            render();
            break;
          case "del-habit":
            state.habits = state.habits.filter(function (h) { return h.id !== id; });
            save(); render();
            break;
          case "toggle-ex":
            dayData = getDay(key);
            updateDay(key, { exercises: dayData.exercises.map(function (e) { return e.id === id ? Object.assign({}, e, { done: !e.done }) : e; }) });
            render();
            break;
          case "del-ex":
            dayData = getDay(key);
            updateDay(key, { exercises: dayData.exercises.filter(function (e) { return e.id !== id; }) });
            render();
            break;
          case "add-habit":
            addHabit(); break;
          case "add-ex":
            addExercise(key); break;
        }
      });
    });

    var habitInput = document.getElementById("new-habit-input");
    if (habitInput) habitInput.addEventListener("keydown", function (e) { if (e.key === "Enter") addHabit(); });

    var exInput = document.getElementById("new-ex-input");
    if (exInput) exInput.addEventListener("keydown", function (e) { if (e.key === "Enter") addExercise(key); });

    var noteInput = document.getElementById("note-input");
    if (noteInput) {
      noteInput.addEventListener("input", function () {
        updateDay(key, { note: noteInput.value });
      });
    }

    var bed = document.getElementById("sleep-bed");
    var wake = document.getElementById("sleep-wake");
    if (bed) bed.addEventListener("change", function () {
      var d = getDay(key);
      updateDay(key, { sleep: Object.assign({}, d.sleep, { bed: bed.value }) });
      render();
    });
    if (wake) wake.addEventListener("change", function () {
      var d = getDay(key);
      updateDay(key, { sleep: Object.assign({}, d.sleep, { wake: wake.value }) });
      render();
    });

    var splitSel = document.getElementById("split-select");
    if (splitSel) splitSel.addEventListener("change", function () {
      state.split[selected.getDay()] = splitSel.value;
      save(); render();
    });

    function addHabit() {
      var input = document.getElementById("new-habit-input");
      var name = input.value.trim();
      if (!name) return;
      state.habits.push({ id: uid(), name: name });
      save(); render();
    }
    function addExercise(k) {
      var input = document.getElementById("new-ex-input");
      var name = input.value.trim();
      if (!name) return;
      var d = getDay(k);
      updateDay(k, { exercises: d.exercises.concat([{ id: uid(), name: name, done: false }]) });
      render();
    }
  }

  render(); // show "checking sign-in…" immediately

  watchAuth(function (user) {
    authReady = true;
    if (unsubscribeData) { unsubscribeData(); unsubscribeData = null; }

    if (user) {
      currentUser = user;
      unsubscribeData = subscribeData(user.uid, function (remoteState) {
        applyingRemote = true;
        if (remoteState) {
          state.habits = remoteState.habits || [];
          state.split = remoteState.split || Object.assign({}, DEFAULT_SPLIT);
          state.days = remoteState.days || {};
        } else {
          // first time this account has signed in — push whatever's local (e.g. guest data)
          pushData(user.uid, state).catch(function (e) { console.error(e); });
        }
        render();
        applyingRemote = false;
      });
    } else {
      currentUser = null;
      state = { habits: [], split: Object.assign({}, DEFAULT_SPLIT), days: {} };
      render();
    }
  });
})();
