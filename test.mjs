// Run: node test.mjs
import assert from "node:assert/strict";
import { e1rm, lastSets, suggest, series, bestE1rm, movingAvg } from "./logic.js";

assert.equal(e1rm(100, 1), 100);
assert.equal(e1rm(100, 12), 140);

const W = (start, sets, done = true) => ({ start, done, items: [{ ex: "Bench", sets }] });
const ws = [W(1, [{ w: 80, r: 12 }, { w: 80, r: 12 }, { w: 80, r: 9 }]), W(2, [{ w: 81, r: 12 }, { w: 81, r: 10 }]), W(3, [{ w: 99, r: 1 }], false)];

// last finished workout wins, unfinished ignored
assert.deepEqual(lastSets(ws, "Bench"), [{ w: 81, r: 12 }, { w: 81, r: 10 }]);
assert.equal(lastSets(ws, "Squat"), null);

// first two sets at 12 -> up; third set does not matter
assert.deepEqual(suggest(ws[0].items[0].sets, 1), { w: 81, up: true });
assert.deepEqual(suggest(ws[1].items[0].sets, 2), { w: 81, up: false });
assert.deepEqual(suggest([{ w: 50, r: 12 }], 2), { w: 52, up: true });
assert.equal(suggest(null, 1), null);

assert.deepEqual(series(ws, "Bench").map((p) => p.y), [112, 113.4]);
assert.equal(bestE1rm(ws.filter((w) => w.done), "Bench", [{ w: 100, r: 5 }]), 116.7);

const day = 864e5;
assert.deepEqual(movingAvg([{ x: 0, y: 80 }, { x: day, y: 82 }, { x: 8 * day, y: 90 }]).map((p) => p.y), [80, 81, 90]);

console.log("ok");
