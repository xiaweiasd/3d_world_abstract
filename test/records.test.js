import test from "node:test";
import assert from "node:assert/strict";
import { mergeRecords, parseImport, resolveLayer } from "../src/records.js";
import { layoutEntries } from "../src/layout.js";
import { layerById } from "../src/records.js";

test("empty layer names land in faint concepts", () => {
  assert.equal(resolveLayer(""), "faint-concept");
  assert.equal(resolveLayer("Literature"), "literary");
  assert.equal(resolveLayer("grammar"), "unspoken-framework");
  assert.equal(resolveLayer("no-such-land"), null);
});

test("json and csv imports become records", () => {
  const json = parseImport(JSON.stringify([
    { word: "afterlight", layer: "faint concepts", gloss: "A private brightness." },
  ]));
  assert.equal(json.errors.length, 0);
  assert.equal(json.records[0].layer, "faint-concept");
  assert.equal(json.records[0].source, "imported");

  const csv = parseImport('word,layer,gloss\nredthread,private symbol,"A mark, kept."\n');
  assert.equal(csv.records[0].word, "redthread");
  assert.equal(csv.records[0].gloss, "A mark, kept.");
  assert.equal(csv.records[0].layer, "private-symbol");
});

test("import updates a word instead of duplicating it", () => {
  const current = [{
    id: "en-00001",
    word: "home",
    layer: "everyday",
    pos: "noun",
    gloss: "where you live",
    example: "",
    note: "",
    source: "wordnet",
    sample: false,
    rank: 30,
    landmark: true,
  }];
  const incoming = parseImport('[{"word":"home","layer":"private-symbol","gloss":"Mine."}]').records;
  const merged = mergeRecords(current, incoming);
  assert.equal(merged.added, 0);
  assert.equal(merged.updated, 1);
  assert.equal(merged.entries.length, 1);
  assert.equal(merged.entries[0].id, "en-00001");
  assert.equal(merged.entries[0].layer, "private-symbol");
  assert.equal(merged.entries[0].source, "imported");
});

test("import does not drop words that differ only by case", () => {
  const current = [
    { id: "1", word: "post", layer: "everyday", pos: "noun", gloss: "mail", example: "", note: "", source: "wordnet", sample: false, rank: 1, landmark: false },
    { id: "2", word: "Post", layer: "everyday", pos: "noun", gloss: "a name", example: "", note: "", source: "wordnet", sample: false, rank: null, landmark: false },
  ];
  const incoming = parseImport('[{"word":"afterlight","gloss":"A private brightness."}]').records;
  const merged = mergeRecords(current, incoming);
  assert.equal(merged.added, 1);
  assert.equal(merged.entries.length, 3);
});

test("words stay inside their land", () => {
  const entries = [
    { id: "a", word: "alpha", layer: "everyday" },
    { id: "b", word: "beta", layer: "everyday" },
    { id: "c", word: "gamma", layer: "literary" },
  ];
  const positions = layoutEntries(entries);
  for (const entry of entries) {
    const layer = layerById(entry.layer);
    const position = positions.get(entry.id);
    const distance = Math.hypot(position.x - layer.x, position.z - layer.z);
    assert.ok(distance <= layer.radius);
    assert.ok(position.y > layer.raise);
  }
});
