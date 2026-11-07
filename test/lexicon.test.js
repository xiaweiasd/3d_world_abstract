import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const entries = JSON.parse(await readFile(new URL("../public/lexicon.json", import.meta.url), "utf8"));

test("the test world holds 10,000 distinct words", () => {
  assert.equal(entries.length, 10000);
  assert.equal(new Set(entries.map((entry) => entry.word)).size, 10000);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 10000);
});

test("every land is populated and every record can be read", () => {
  const layers = ["everyday", "academic", "literary", "faint-concept", "private-symbol", "unspoken-framework"];
  for (const layer of layers) {
    assert.ok(entries.some((entry) => entry.layer === layer), layer);
  }
  for (const entry of entries) {
    assert.ok(entry.word);
    assert.equal(typeof entry.gloss, "string");
    assert.ok(entry.gloss.length > 0);
    assert.ok(layers.includes(entry.layer));
  }
});

test("known words keep a true common meaning", () => {
  const byWord = Object.fromEntries(entries.map((entry) => [entry.word, entry]));
  assert.match(byWord.bread.gloss, /baked/i);
  assert.equal(byWord.bread.layer, "everyday");
  assert.match(byWord.metaphor.gloss, /figure of speech/i);
  assert.equal(byWord.metaphor.layer, "literary");
  assert.match(byWord.grammar.gloss, /syntax/i);
  assert.equal(byWord.grammar.layer, "unspoken-framework");
  assert.match(byWord.door.gloss, /entrance/i);
  assert.equal(byWord.door.layer, "private-symbol");
  assert.match(byWord.the.gloss, /article/i);
  assert.equal(byWord.the.source, "authored");
  assert.equal(byWord.can.layer, "unspoken-framework");
  assert.match(byWord.can.gloss, /ability/i);
});
