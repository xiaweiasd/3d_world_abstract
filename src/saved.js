export const SAVED_KEY = "english-world.saved";

function blankStorage() {
  return { getItem: () => null, setItem: () => {} };
}

export function loadSaved(storage = blankStorage()) {
  try {
    const parsed = JSON.parse(storage.getItem(SAVED_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.word === "string" && item.word.trim());
  } catch {
    return [];
  }
}

export function writeSaved(storage, items) {
  storage.setItem(SAVED_KEY, JSON.stringify(items));
}

export function isSaved(items, word) {
  const key = String(word ?? "").trim().toLowerCase();
  return items.some((item) => item.word.toLowerCase() === key);
}

export function toggleSaved(items, entry, savedAt = new Date().toISOString()) {
  const key = String(entry.word ?? "").trim().toLowerCase();
  if (!key) return items;
  if (isSaved(items, key)) {
    return items.filter((item) => item.word.toLowerCase() !== key);
  }
  return [{
    word: entry.word.trim(),
    layer: entry.layer || "faint-concept",
    pos: entry.pos || "word",
    gloss: entry.gloss || "",
    example: entry.example || "",
    note: entry.note || "",
    savedAt,
  }, ...items];
}

export function exportSaved(items) {
  return items.map(({ word, layer, pos, gloss, example, note }) => ({
    word,
    layer,
    pos,
    gloss,
    example,
    note,
  }));
}
