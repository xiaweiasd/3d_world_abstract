import test from "node:test";
import assert from "node:assert/strict";
import { exportSaved, isSaved, loadSaved, SAVED_KEY, toggleSaved, writeSaved } from "../src/saved.js";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    data,
  };
}

const door = {
  word: "door",
  layer: "private-symbol",
  pos: "noun",
  gloss: "A swinging barrier.",
  example: "He knocked on the door.",
  note: "A private mark.",
};

test("saving a word stores it and saving again removes it", () => {
  const storage = memoryStorage();
  const saved = toggleSaved([], door, "2026-11-07T12:00:00.000Z");
  writeSaved(storage, saved);
  const loaded = loadSaved(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].word, "door");
  assert.equal(loaded[0].savedAt, "2026-11-07T12:00:00.000Z");
  assert.equal(isSaved(loaded, "Door"), true);
  const removed = toggleSaved(loaded, { word: "DOOR" });
  assert.equal(removed.length, 0);
});

test("a broken store reads as an empty collection", () => {
  const storage = memoryStorage({ [SAVED_KEY]: "{not json" });
  assert.deepEqual(loadSaved(storage), []);
  assert.deepEqual(loadSaved(memoryStorage({ [SAVED_KEY]: "{\"word\":\"door\"}" })), []);
});

test("export keeps the fields an import can read", () => {
  const saved = toggleSaved([], door, "2026-11-07T12:00:00.000Z");
  assert.deepEqual(exportSaved(saved), [{
    word: "door",
    layer: "private-symbol",
    pos: "noun",
    gloss: "A swinging barrier.",
    example: "He knocked on the door.",
    note: "A private mark.",
  }]);
});
