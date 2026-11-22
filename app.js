import DB from "./exercises.js";
import { e1rm, lastSets, suggest, series, bestE1rm, movingAvg, TARGET_REPS } from "./logic.js";

// ---------- state ----------
const KEY = "gym-v1";
const BLANK = () => ({ plans: [], workouts: [], body: {}, opts: {}, custom: [], lastBackup: 0 });
let S = load();
let pickFor = null; // {type: 'plan'|'workout', id}

function load() {
  try { return { ...BLANK(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return BLANK(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast("Speichern fehlgeschlagen. Exportiere ein Backup."); }
}

// ---------- helpers ----------
const $ = (s) => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (n) => Number(n).toLocaleString("de-AT", { maximumFractionDigits: 1 });
const today = () => new Date().toLocaleDateString("sv-SE");
const dayMs = (d) => Date.parse(d + "T12:00:00");
const fmtDay = (ms) => new Date(ms).toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" });
const fmtDate = (ms) => new Date(ms).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit" });
const MUSCLE = Object.fromEntries(DB.map(([n, m]) => [n, m]));
for (const c of S.custom) MUSCLE[c] = "eigene";
const name = (ex) => S.opts[ex]?.name || ex;
const step = (ex) => S.opts[ex]?.step ?? 1;
const rest = (ex) => S.opts[ex]?.rest ?? 90;
const planName = (id) => S.plans.find((p) => p.id === id)?.name || "Freies Training";
const finished = () => S.workouts.filter((w) => w.done).sort((a, b) => b.start - a.start);
const active = () => S.workouts.find((w) => !w.done);
const setsText = (sets) => sets.map((s) => `${num(s.w)}×${s.r}`).join("  ");

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("on"), 3200);
}

// ---------- views ----------
const views = {
  train() {
    const cur = active();
    const plans = S.plans.length
      ? S.plans.map((p) => `<button class="big" data-act="start" data-id="${p.id}">${esc(p.name)}<small>${p.items.length} Übungen</small></button>`).join("")
      : `<p class="muted">Lege unter <a href="#/plans">Pläne</a> deinen ersten Plan an, oder starte frei.</p>`;
    const hist = finished().map((w) => {
      const n = w.items.reduce((a, it) => a + it.sets.length, 0);
      return `<a class="row" href="#/workout/${w.id}"><span>${fmtDay(w.start)}</span><b>${esc(planName(w.plan))}</b><span class="muted">${w.items.length} Übungen, ${n} Sätze</span></a>`;
    }).join("");
    const hasData = S.workouts.length || Object.keys(S.body).length;
    const stale = hasData && Date.now() - S.lastBackup > 14 * 864e5;
    return `
      ${stale ? `<div class="banner">Dein letztes Backup ist ${S.lastBackup ? "über 14 Tage alt" : "noch nicht gemacht"}. <button data-act="export">Jetzt sichern</button></div>` : ""}
      <h1>Training</h1>
      ${cur ? `<a class="big primary" href="#/workout/${cur.id}">Training fortsetzen<small>${esc(planName(cur.plan))}, seit ${new Date(cur.start).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}</small></a>`
            : `<div class="stack">${plans}<button class="big ghost" data-act="start" data-id="">Freies Training</button></div>`}
      <h2>Verlauf</h2>
      ${hist || `<p class="muted">Noch keine Trainings. Dein erstes beendetes Training erscheint hier.</p>`}
      <h2>Backup</h2>
      <p class="muted">Deine Daten liegen nur auf diesem iPhone. ${S.lastBackup ? `Letztes Backup: ${fmtDate(S.lastBackup)}.` : "Noch kein Backup."}</p>
      <div class="pair"><button data-act="export">Backup exportieren</button><button data-act="import">Backup importieren</button></div>`;
  },

  workout(id) {
    const w = S.workouts.find((x) => x.id === id);
    if (!w) return views.train();
    const live = !w.done;
    const others = S.workouts.filter((x) => x.id !== w.id);
    const items = w.items.map((it, i) => {
      const last = lastSets(others, it.ex);
      const sug = suggest(last, step(it.ex));
      const rows = it.sets.map((s, j) => `
        <div class="set${live && !s.d ? "" : " done"}">
          <span class="n">${j + 1}</span>
          ${stepper("w", i, j, s.w, "kg")}
          ${stepper("r", i, j, s.r, "Wdh")}
          ${live ? `<button class="check" data-act="check" data-i="${i}" data-j="${j}" aria-pressed="${!!s.d}" aria-label="Satz ${j + 1} erledigt">✓</button>`
                 : `<button class="x" data-act="delset" data-i="${i}" data-j="${j}" aria-label="Satz ${j + 1} löschen">×</button>`}
        </div>`).join("");
      return `<section class="ex">
        <header><a href="#/ex/${encodeURIComponent(it.ex)}">${esc(name(it.ex))}</a>
          <button class="x" data-act="delitem" data-i="${i}" aria-label="Übung entfernen">×</button></header>
        ${live && last ? `<p class="last">Letztes Mal: ${setsText(last)}${sug.up ? ` <span class="up">+${num(step(it.ex))} kg heute</span>` : ""}</p>` : ""}
        ${rows}
        <button class="add" data-act="addset" data-i="${i}">Satz hinzufügen</button>
      </section>`;
    }).join("");
    return `
      <h1>${esc(planName(w.plan))}<small>${fmtDay(w.start)}</small></h1>
      ${items || `<p class="muted">Füge die erste Übung hinzu.</p>`}
      <button class="add" data-act="pick" data-type="workout" data-id="${w.id}">Übung hinzufügen</button>
      ${live ? `<button class="big primary" data-act="finish" data-id="${w.id}">Training beenden<small>Nur abgehakte Sätze werden gespeichert</small></button>
                <button class="danger" data-act="delworkout" data-id="${w.id}">Training verwerfen</button>`
             : `<button class="danger" data-act="delworkout" data-id="${w.id}">Training löschen</button>`}`;
  },

  plans() {
    const list = S.plans.map((p) => `<a class="row" href="#/plan/${p.id}"><b>${esc(p.name)}</b><span class="muted">${p.items.map((it) => esc(name(it.ex))).join(", ") || "Noch leer"}</span></a>`).join("");
    return `<h1>Pläne</h1>${list || `<p class="muted">Ein Plan ist eine Liste von Übungen mit Satzanzahl, z. B. „Push“.</p>`}
      <button class="big ghost" data-act="newplan">Neuer Plan</button>`;
  },

  plan(id) {
    const p = S.plans.find((x) => x.id === id);
    if (!p) return views.plans();
    const items = p.items.map((it, i) => `
      <div class="pitem">
        <a href="#/ex/${encodeURIComponent(it.ex)}">${esc(name(it.ex))}</a>
        <span class="mini"><button data-act="psets" data-i="${i}" data-d="-1" aria-label="Weniger Sätze">−</button><b>${it.sets}</b> Sätze<button data-act="psets" data-i="${i}" data-d="1" aria-label="Mehr Sätze">+</button></span>
        <button class="x" data-act="pup" data-i="${i}" aria-label="Nach oben" ${i ? "" : "disabled"}>↑</button>
        <button class="x" data-act="pdel" data-i="${i}" aria-label="Entfernen">×</button>
      </div>`).join("");
    return `<label class="field">Name<input data-act="pname" value="${esc(p.name)}"></label>
      <p class="muted">Ziel pro Satz: ${TARGET_REPS} Wiederholungen. Schaffst du sie in den ersten zwei Sätzen, schlägt die App beim nächsten Mal mehr Gewicht vor.</p>
      ${items}
      <button class="add" data-act="pick" data-type="plan" data-id="${p.id}">Übung hinzufügen</button>
      <button class="danger" data-act="delplan" data-id="${p.id}">Plan löschen</button>`;
  },

  pick() {
    if (!pickFor) return views.train();
    return `<h1>Übung wählen</h1>
      <input id="q" type="search" placeholder="Suchen, z. B. bench, squat, curl" autocomplete="off">
      <div id="picklist">${pickList("")}</div>`;
  },

  progress() {
    const exs = [...new Set(finished().flatMap((w) => w.items.map((it) => it.ex)))];
    const rows = exs.map((ex) => `<a class="row" href="#/ex/${encodeURIComponent(ex)}"><b>${esc(name(ex))}</b><span class="val">${num(bestE1rm(finished(), ex))}<small>kg 1RM</small></span></a>`).join("");
    return `<h1>Fortschritt</h1>${rows || `<p class="muted">Nach deinem ersten Training siehst du hier jede Übung mit ihrem geschätzten 1RM.</p>`}`;
  },

  ex(ex) {
    const pts = series(S.workouts, ex);
    const ws = finished().filter((w) => w.items.some((it) => it.ex === ex && it.sets.length));
    const all = ws.flatMap((w) => w.items.filter((it) => it.ex === ex).flatMap((it) => it.sets));
    const heavy = all.reduce((a, s) => (s.w > (a?.w ?? -1) ? s : a), null);
    const hist = ws.map((w) => `<a class="row" href="#/workout/${w.id}"><span>${fmtDay(w.start)}</span><span class="sets">${setsText(w.items.find((it) => it.ex === ex).sets)}</span></a>`).join("");
    return `<h1>${esc(name(ex))}<small>${esc(MUSCLE[ex] || "")}</small></h1>
      ${all.length ? `<div class="stats">
        <div><b>${num(bestE1rm(finished(), ex))}</b><span>kg geschätztes 1RM</span></div>
        <div><b>${num(heavy.w)}</b><span>kg schwerster Satz, ${heavy.r} Wdh</span></div>
        <div><b>${ws.length}</b><span>Trainings</span></div></div>` : ""}
      ${chart("c1", [{ pts, label: "Geschätztes 1RM", kind: "line", color: "var(--c1)" }], "kg", "Ab zwei Trainings mit dieser Übung siehst du hier deine Kurve.")}
      <h2>Verlauf</h2>${hist || `<p class="muted">Noch keine Sätze.</p>`}
      <h2>Einstellungen</h2>
      <label class="field">Anzeigename<input data-act="oname" data-ex="${esc(ex)}" value="${esc(name(ex))}"></label>
      <div class="pair">
        <label class="field">Steigerung (kg)<input data-act="ostep" data-ex="${esc(ex)}" type="number" inputmode="decimal" min="0" step="1" value="${step(ex)}"></label>
        <label class="field">Pause (Sek.)<input data-act="orest" data-ex="${esc(ex)}" type="number" inputmode="numeric" min="0" step="15" value="${rest(ex)}"></label>
      </div>`;
  },

  body() {
    const entries = Object.entries(S.body).map(([d, y]) => ({ d, x: dayMs(d), y })).sort((a, b) => a.x - b.x);
    const avg = movingAvg(entries);
    const lastY = entries.at(-1)?.y ?? "";
    const list = entries.slice(-14).reverse().map((e) => `<div class="row"><span>${fmtDay(e.x)}</span><b>${num(e.y)} kg</b><button class="x" data-act="delbody" data-d="${e.d}" aria-label="Eintrag löschen">×</button></div>`).join("");
    return `<h1>Gewicht</h1>
      ${avg.length ? `<div class="hero"><b>${num(avg.at(-1).y)}</b><span>kg, Schnitt der letzten 7 Tage</span></div>` : ""}
      <form class="weigh" data-act="addbody">
        <input name="y" type="number" inputmode="decimal" step="0.1" min="20" max="400" value="${lastY}" placeholder="kg" aria-label="Gewicht in kg" required>
        <button class="primary">Speichern</button>
        <input name="d" type="date" value="${today()}" aria-label="Datum">
      </form>
      ${chart("c2", [
        { pts: entries, label: "Gewogen", kind: "dots", color: "var(--c2)" },
        { pts: avg, label: "7-Tage-Schnitt", kind: "line", color: "var(--c1)" },
      ], "kg", "Ab zwei Einträgen siehst du hier deine Kurve.")}
      ${list}`;
  },
};

function stepper(f, i, j, v, unit) {
  return `<span class="step">
    <button data-act="inc" data-f="${f}" data-i="${i}" data-j="${j}" data-d="-1" aria-label="${unit} minus">−</button>
    <input class="num" data-f="${f}" data-i="${i}" data-j="${j}" value="${String(v).replace(".", ",")}" inputmode="decimal" aria-label="${unit}">
    <button data-act="inc" data-f="${f}" data-i="${i}" data-j="${j}" data-d="1" aria-label="${unit} plus">+</button>
    <small>${unit}</small></span>`;
}

function pickList(q) {
  q = q.trim().toLowerCase();
  const used = [...new Set([...S.custom, ...S.plans.flatMap((p) => p.items.map((i) => i.ex)), ...S.workouts.flatMap((w) => w.items.map((i) => i.ex))])];
  const pool = q ? [...S.custom, ...DB.map((d) => d[0])] : used;
  const hits = pool.filter((ex) => !q || name(ex).toLowerCase().includes(q) || ex.toLowerCase().includes(q) || (MUSCLE[ex] || "").includes(q)).slice(0, 60);
  const rows = hits.map((ex) => `<button class="row" data-act="pickex" data-ex="${esc(ex)}"><b>${esc(name(ex))}</b><span class="muted">${esc(MUSCLE[ex] || "")}</span></button>`).join("");
  const create = q && !hits.some((ex) => name(ex).toLowerCase() === q)
    ? `<button class="add" data-act="custom">„${esc(q)}“ als eigene Übung anlegen</button>` : "";
  const hint = q ? "" : `<p class="muted">${used.length ? "Deine Übungen. " : ""}Tippe oben, um alle ${DB.length} Übungen zu durchsuchen (englische Namen).</p>`;
  return hint + rows + create;
}

// ---------- chart (inline SVG, tap for values) ----------
const charts = {};
function chart(id, sers, unit, empty) {
  const base = sers[0].pts;
  if (base.length < 2) return `<p class="muted chart-empty">${empty}</p>`;
  charts[id] = { sers, unit };
  const W = 340, H = 190, L = 34, R = 8, T = 10, B = 24;
  const xs = base.map((p) => p.x), ys = sers.flatMap((s) => s.pts.map((p) => p.y));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const span = Math.max(y1 - y0, 2), st = niceStep(span / 3);
  y0 = Math.floor((y0 - span * 0.1) / st) * st; y1 = Math.ceil((y1 + span * 0.1) / st) * st;
  const sx = (x) => L + ((x - x0) / (x1 - x0)) * (W - L - R), sy = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  charts[id].geo = { sx, sy, L, R, W, H, T, B };
  let g = "";
  for (let y = y0; y <= y1 + 1e-9; y += st) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(y)}" y2="${sy(y)}"/><text class="tick" x="${L - 6}" y="${sy(y) + 4}" text-anchor="end">${num(y)}</text>`;
  g += `<text class="tick" x="${L}" y="${H - 6}">${fmtDate(x0)}</text><text class="tick" x="${W - R}" y="${H - 6}" text-anchor="end">${fmtDate(x1)}</text>`;
  const marks = sers.map((s) => s.kind === "line"
    ? `<polyline fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${s.pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}"/>`
    : s.pts.map((p) => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`).join("")).join("");
  const legend = sers.length > 1 ? `<div class="legend">${sers.map((s) => `<span><i class="${s.kind}" style="--c:${s.color}"></i>${s.label}</span>`).join("")}</div>` : "";
  return `<figure class="chart" data-chart="${id}">${legend}
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${sers.map((s) => s.label).join(" und ")} über die Zeit">${g}${marks}
      <line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/></svg>
    <div class="tip" hidden></div></figure>`;
}
function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
function chartTap(fig, clientX) {
  const c = charts[fig.dataset.chart], svg = fig.querySelector("svg"), r = svg.getBoundingClientRect();
  const x = ((clientX - r.left) / r.width) * c.geo.W;
  const base = c.sers[0].pts;
  let k = 0;
  base.forEach((p, i) => { if (Math.abs(c.geo.sx(p.x) - x) < Math.abs(c.geo.sx(base[k].x) - x)) k = i; });
  const px = c.geo.sx(base[k].x), cross = svg.querySelector(".cross");
  cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
  const tip = fig.querySelector(".tip");
  tip.innerHTML = `<b>${fmtDay(base[k].x)}</b>` + c.sers.map((s) => `<span>${s.label}: ${num(s.pts[k].y)} ${c.unit}</span>`).join("");
  tip.hidden = false;
  const pct = (px / c.geo.W) * 100, right = pct > 50;
  tip.style.left = right ? "auto" : `calc(${pct}% + 8px)`;
  tip.style.right = right ? `calc(${100 - pct}% + 8px)` : "auto";
}

// ---------- workout actions ----------
function newSets(ex, n) {
  const sug = suggest(lastSets(S.workouts, ex), step(ex));
  return Array.from({ length: n }, () => ({ w: sug ? sug.w : 0, r: TARGET_REPS, d: false }));
}
const cur = () => S.workouts.find((x) => x.id === route()[1]);

const act = {
  start({ id }) {
    const p = S.plans.find((x) => x.id === id);
    const w = { id: uid(), start: Date.now(), plan: id || null, done: false, items: (p?.items || []).map((it) => ({ ex: it.ex, sets: newSets(it.ex, it.sets) })) };
    S.workouts.push(w); save(); go(`#/workout/${w.id}`);
  },
  inc({ f, i, j, d }) {
    const s = cur().items[i].sets[j];
    s[f] = Math.max(0, Math.round((s[f] + Number(d)) * 10) / 10); save(); render();
  },
  check({ i, j }) {
    unlockAudio();
    const w = cur(), it = w.items[i], s = it.sets[j];
    s.d = !s.d; save(); render();
    if (!s.d) return;
    const prev = bestE1rm(S.workouts.filter((x) => x.done && x.id !== w.id), it.ex, it.sets.filter((x, k) => x.d && k !== +j));
    if (prev > 0 && e1rm(s.w, s.r) > prev) toast(`Neuer PR! ${name(it.ex)}: ${num(s.w)} kg × ${s.r}`);
    timer.start(rest(it.ex));
  },
  addset({ i }) {
    const w = cur(), sets = w.items[i].sets, l = sets.at(-1);
    sets.push(w.done ? { w: l?.w ?? 0, r: l?.r ?? TARGET_REPS } : { w: l?.w ?? 0, r: l?.r ?? TARGET_REPS, d: false }); save(); render();
  },
  delset({ i, j }) { cur().items[i].sets.splice(j, 1); save(); render(); },
  delitem({ i }) {
    const w = cur();
    if (confirm(`${name(w.items[i].ex)} aus diesem Training entfernen?`)) { w.items.splice(i, 1); save(); render(); }
  },
  finish({ id }) {
    const w = S.workouts.find((x) => x.id === id);
    w.items = w.items.map((it) => ({ ex: it.ex, sets: it.sets.filter((s) => s.d).map(({ w, r }) => ({ w, r })) })).filter((it) => it.sets.length);
    if (w.items.length) w.done = true; else S.workouts = S.workouts.filter((x) => x !== w);
    save(); timer.stop(); releaseWake();
    toast(w.done ? "Training gespeichert" : "Kein Satz abgehakt, nichts gespeichert");
    go("#/train");
  },
  delworkout({ id }) {
    if (!confirm("Dieses Training löschen? Das lässt sich nicht rückgängig machen.")) return;
    S.workouts = S.workouts.filter((x) => x.id !== id); save(); timer.stop(); go("#/train");
  },
  newplan() { const p = { id: uid(), name: "Neuer Plan", items: [] }; S.plans.push(p); save(); go(`#/plan/${p.id}`); },
  psets({ i, d }) { const it = S.plans.find((p) => p.id === route()[1]).items[i]; it.sets = Math.max(1, it.sets + Number(d)); save(); render(); },
  pup({ i }) { const a = S.plans.find((p) => p.id === route()[1]).items; [a[i - 1], a[i]] = [a[i], a[i - 1]]; save(); render(); },
  pdel({ i }) { S.plans.find((p) => p.id === route()[1]).items.splice(i, 1); save(); render(); },
  delplan({ id }) {
    if (!confirm("Plan löschen? Deine Trainings bleiben erhalten.")) return;
    S.plans = S.plans.filter((p) => p.id !== id); save(); go("#/plans");
  },
  pick({ type, id }) { pickFor = { type, id }; go("#/pick"); },
  pickex({ ex }) {
    const { type, id } = pickFor;
    if (type === "plan") S.plans.find((p) => p.id === id).items.push({ ex, sets: 3 });
    else S.workouts.find((w) => w.id === id).items.push({ ex, sets: newSets(ex, 3).map((s) => (S.workouts.find((w) => w.id === id).done ? { w: s.w, r: s.r } : s)) });
    save(); go(`#/${type}/${id}`);
  },
  custom() {
    const n = $("#q").value.trim();
    if (!S.custom.includes(n)) S.custom.push(n);
    MUSCLE[n] = "eigene"; act.pickex({ ex: n });
  },
  delbody({ d }) { delete S.body[d]; save(); render(); },
  export: exportBackup,
  import() { $("#importFile").click(); },
};

// ---------- timer ----------
let audio;
function unlockAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = "transient"; // shortcut: Ton kann je nach iOS-Stummschalter fehlen
    audio ??= new AudioContext();
    audio.resume();
  } catch {}
}
function beep() {
  if (!audio) return;
  [0, 0.35, 0.7].forEach((t) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.4, audio.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + t + 0.25);
    o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.3);
  });
}
const timer = {
  end: 0, iv: 0,
  start(sec) { this.end = Date.now() + sec * 1000; clearInterval(this.iv); this.iv = setInterval(() => this.tick(), 250); this.tick(); },
  add(sec) { this.end += sec * 1000; this.tick(); },
  stop() { clearInterval(this.iv); this.end = 0; $("#timer").hidden = true; },
  left() { return Math.max(0, Math.ceil((this.end - Date.now()) / 1000)); },
  tick() {
    const s = this.left(), el = $("#timer");
    if (!s) { beep(); toast("Pause vorbei"); return this.stop(); }
    const mmss = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    if (el.hidden || !el.firstChild) {
      el.innerHTML = `<b aria-label="Pause"></b>
        <button data-tact="-15">−15</button><button data-tact="15">+15</button>
        <a class="ios" href="#">iPhone-Timer</a><button data-tact="stop" aria-label="Pause beenden">×</button>`;
      el.hidden = false;
    }
    el.querySelector("b").textContent = mmss;
    el.querySelector(".ios").href = `shortcuts://run-shortcut?name=${encodeURIComponent("Gym Pause")}&input=text&text=${s}`;
  },
};
$("#timer").addEventListener("click", (e) => {
  const t = e.target.closest("[data-tact]")?.dataset.tact;
  if (t === "stop") timer.stop(); else if (t) timer.add(Number(t));
});

// keep screen on during a workout
let wake;
async function keepAwake() {
  try { if ("wakeLock" in navigator && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => (wake = null)); } } catch {}
}
function releaseWake() { wake?.release(); wake = null; }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && route()[0] === "workout" && cur() && !cur().done) keepAwake(); if (document.visibilityState === "visible" && timer.end) timer.tick(); });

// ---------- backup ----------
async function exportBackup() {
  const file = new File([JSON.stringify(S)], `gym-backup-${today()}.json`, { type: "application/json" });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); URL.revokeObjectURL(a.href); }
    S.lastBackup = Date.now(); save(); render(); toast("Backup erstellt");
  } catch (e) { if (e.name !== "AbortError") toast("Backup fehlgeschlagen: " + e.message); }
}
$("#importFile").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.workouts) || !Array.isArray(d.plans) || typeof d.body !== "object") throw new Error("Das ist keine Gym-Backup-Datei.");
    if (!confirm(`Backup mit ${d.workouts.length} Trainings laden? Die aktuellen Daten auf diesem iPhone werden ersetzt.`)) return;
    S = { ...BLANK(), ...d }; for (const c of S.custom) MUSCLE[c] = "eigene";
    save(); toast("Backup geladen"); go("#/train");
  } catch (err) { toast("Import fehlgeschlagen: " + err.message); }
});

// ---------- events ----------
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (b && b.tagName !== "INPUT" && b.tagName !== "FORM" && act[b.dataset.act]) { e.preventDefault(); act[b.dataset.act](b.dataset); return; }
  const fig = e.target.closest(".chart");
  if (fig) chartTap(fig, e.clientX);
});
document.addEventListener("change", (e) => {
  const t = e.target, v = t.value.replace(",", ".");
  if (t.classList.contains("num")) {
    const n = parseFloat(v);
    cur().items[t.dataset.i].sets[t.dataset.j][t.dataset.f] = Number.isFinite(n) && n >= 0 ? n : 0;
    save(); return;
  }
  const a = t.dataset.act, ex = t.dataset.ex;
  if (a === "pname") S.plans.find((p) => p.id === route()[1]).name = t.value.trim() || "Plan";
  else if (a === "oname") S.opts[ex] = { ...S.opts[ex], name: t.value.trim() || undefined };
  else if (a === "ostep") S.opts[ex] = { ...S.opts[ex], step: Math.max(0, parseFloat(v) || 0) };
  else if (a === "orest") S.opts[ex] = { ...S.opts[ex], rest: Math.max(0, parseInt(v) || 0) };
  else return;
  save();
});
document.addEventListener("input", (e) => { if (e.target.id === "q") $("#picklist").innerHTML = pickList(e.target.value); });
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target), y = parseFloat(String(f.get("y")).replace(",", "."));
  if (!f.get("d") || !(y > 0)) return toast("Bitte Datum und Gewicht eingeben");
  S.body[f.get("d")] = Math.round(y * 10) / 10; save(); render(); toast("Gewicht gespeichert");
});

// ---------- routing ----------
const route = () => (location.hash.slice(2) || "train").split("/").map(decodeURIComponent);
function go(h) { if (location.hash === h) render(); else location.hash = h; }
const TAB = { train: "train", workout: "train", plans: "plans", plan: "plans", pick: "plans", progress: "progress", ex: "progress", body: "body" };
function render() {
  const [v, arg] = route();
  $("#view").innerHTML = (views[v] || views.train)(arg);
  for (const a of document.querySelectorAll("#tabs a")) a.toggleAttribute("aria-current", a.dataset.tab === (TAB[v] || "train"));
  if (v === "workout" && cur() && !cur().done) keepAwake();
  if (v === "pick") $("#q")?.focus();
}
let lastView;
addEventListener("hashchange", () => { const v = route()[0]; render(); if (v !== lastView) scrollTo(0, 0); lastView = v; });
render();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
