// Pure logic, no DOM. Tested by test.mjs.
export const TARGET_REPS = 12;

// Epley estimate of the one-rep max.
export const e1rm = (w, r) => (r < 1 ? 0 : r === 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10);
const r1 = (n) => Math.round(n * 10) / 10;
// All sets of one exercise in a workout (it may appear twice).
const setsOf = (w, ex) => w.items.filter((x) => x.ex === ex).flatMap((x) => x.sets);

const done = (workouts) => workouts.filter((w) => w.done).sort((a, b) => a.start - b.start);

// Sets of the most recent finished workout that contains this exercise.
export function lastSets(workouts, ex) {
  const list = done(workouts);
  for (let i = list.length - 1; i >= 0; i--) {
    const sets = setsOf(list[i], ex);
    if (sets.length) return sets;
  }
  return null;
}

// Target is always 12 reps: if both of the first two sets hit 12, go up by `step`.
export function suggest(last, step) {
  if (!last || !last.length) return null;
  const up = last.length >= 2 && last.slice(0, 2).every((s) => s.r >= TARGET_REPS);
  return { w: r1(last[0].w + (up ? step : 0)), up };
}

// Best e1RM per finished workout, oldest first.
export function series(workouts, ex) {
  const pts = [];
  for (const w of done(workouts)) {
    const sets = setsOf(w, ex);
    if (sets.length) pts.push({ x: w.start, y: Math.max(...sets.map((s) => e1rm(s.w, s.r))) });
  }
  return pts;
}

// Make any loaded/imported data safe to render: right types, numbers are numbers, ids are plain.
export function normalize(d) {
  const o = d && typeof d === "object" ? d : {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const num = (v, def = 0) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : def);
  const id = (v) => typeof v === "string" && /^[\w-]{1,40}$/.test(v);
  const str = (v) => (typeof v === "string" ? v.slice(0, 200) : "");
  const sets = (a) => arr(a).filter((s) => s && typeof s === "object").map((s) => {
    const o2 = { w: Math.max(0, num(s.w)), r: Math.max(0, Math.round(num(s.r))) };
    if ("d" in s) o2.d = !!s.d;
    return o2;
  });
  const items = (a) => arr(a).filter((i) => i && typeof i.ex === "string" && i.ex).map((i) => ({ ex: str(i.ex), sets: sets(i.sets) }));
  return {
    plans: arr(o.plans).filter((p) => p && id(p.id)).map((p) => ({
      id: p.id, name: str(p.name) || "Plan",
      items: arr(p.items).filter((i) => i && typeof i.ex === "string" && i.ex).map((i) => ({ ex: str(i.ex), sets: Math.max(1, Math.round(num(i.sets, 3))) })),
    })),
    workouts: arr(o.workouts).filter((w) => w && id(w.id)).map((w) => ({
      id: w.id, start: num(w.start, Date.now()), plan: id(w.plan) ? w.plan : null, planName: str(w.planName), done: !!w.done, items: items(w.items),
    })),
    body: Object.fromEntries(Object.entries(obj(o.body)).filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && num(v) > 0).map(([k, v]) => [k, r1(num(v))])),
    opts: Object.fromEntries(Object.entries(obj(o.opts)).map(([k, v]) => {
      v = obj(v);
      const x = {};
      if (str(v.name)) x.name = str(v.name);
      if (v.step != null && num(v.step, -1) >= 0) x.step = num(v.step);
      if (v.rest != null && num(v.rest, -1) >= 0) x.rest = Math.round(num(v.rest));
      return [k, x];
    })),
    custom: arr(o.custom).filter((c) => typeof c === "string" && c).map(str),
    lastBackup: num(o.lastBackup),
  };
}

// Best e1RM over all sets in `workouts`; `extra` = sets not yet saved (current workout).
export function bestE1rm(workouts, ex, extra = []) {
  let best = 0;
  for (const w of workouts) for (const it of w.items) if (it.ex === ex) for (const s of it.sets) best = Math.max(best, e1rm(s.w, s.r));
  for (const s of extra) best = Math.max(best, e1rm(s.w, s.r));
  return best;
}

// Trailing 7-day average. entries: [{x: ms, y: kg}] sorted by x.
export function movingAvg(entries, days = 7) {
  const span = days * 864e5;
  return entries.map((e, i) => {
    const win = entries.slice(0, i + 1).filter((p) => p.x > e.x - span);
    return { x: e.x, y: Math.round((win.reduce((a, p) => a + p.y, 0) / win.length) * 10) / 10 };
  });
}
