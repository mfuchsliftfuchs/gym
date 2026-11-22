// Pure logic, no DOM. Tested by test.mjs.
export const TARGET_REPS = 12;

// Epley estimate of the one-rep max.
export const e1rm = (w, r) => (r <= 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10);

const done = (workouts) => workouts.filter((w) => w.done).sort((a, b) => a.start - b.start);

// Sets of the most recent finished workout that contains this exercise.
export function lastSets(workouts, ex) {
  const list = done(workouts);
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i].items.find((x) => x.ex === ex && x.sets.length);
    if (it) return it.sets;
  }
  return null;
}

// Target is always 12 reps: if the first two sets hit 12, go up by `step`.
export function suggest(last, step) {
  if (!last || !last.length) return null;
  const up = last.slice(0, 2).every((s) => s.r >= TARGET_REPS);
  return { w: last[0].w + (up ? step : 0), up };
}

// Best e1RM per finished workout, oldest first.
export function series(workouts, ex) {
  const pts = [];
  for (const w of done(workouts)) {
    const it = w.items.find((x) => x.ex === ex);
    if (!it || !it.sets.length) continue;
    pts.push({ x: w.start, y: Math.max(...it.sets.map((s) => e1rm(s.w, s.r))) });
  }
  return pts;
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
