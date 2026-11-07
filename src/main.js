import "./style.css";
import { LAYERS, layerById, mergeRecords, parseImport, sourceLabel } from "./records.js";
import { exportSaved, isSaved, loadSaved, toggleSaved, writeSaved } from "./saved.js";
import { EnglishWorld } from "./world.js";

const loading = document.querySelector("#loading");
const loadingNote = document.querySelector("#loading-note");
const census = document.querySelector("#census");
const region = document.querySelector("#region");
const layers = document.querySelector("#layers");
const searchForm = document.querySelector("#search");
const searchInput = document.querySelector("#search-input");
const results = document.querySelector("#results");
const reader = document.querySelector("#reader");
const status = document.querySelector("#status");
const importFile = document.querySelector("#import-file");

let entries = [];
let saved = [];
let world;

boot().catch((error) => {
  loadingNote.textContent = "The word list could not be opened.";
  console.error(error);
});

async function boot() {
  const original = await loadLexicon();
  entries = original.map((entry) => ({ ...entry }));
  world = new EnglishWorld(document.querySelector("#scene"), document.querySelector("#labels"));
  world.setEntries(entries);
  world.onSelect = showEntry;
  saved = loadSaved(localStorage);
  renderCensus();
  renderLayers();
  renderSaved();
  loading.classList.add("done");
  bind(original);
}

function bind(original) {

document.querySelector("#reader-close").addEventListener("click", () => {
  reader.hidden = true;
});

document.querySelector("#save-word").addEventListener("click", () => {
  const word = document.querySelector("#reader-word").textContent;
  const entry = entries.find((item) => item.word.toLowerCase() === word.toLowerCase())
    || saved.find((item) => item.word.toLowerCase() === word.toLowerCase());
  if (!entry) return;
  saved = toggleSaved(saved, entry);
  try {
    writeSaved(localStorage, saved);
  } catch {
    setStatus("This browser could not store the saved word.");
    saved = loadSaved(localStorage);
  }
  renderSaved();
  updateSaveButton(word);
  setStatus(isSaved(saved, word) ? `Saved ${word}.` : `Removed ${word} from saved words.`);
});

document.querySelector("#saved-button").addEventListener("click", () => {
  const panel = document.querySelector("#saved");
  panel.hidden = !panel.hidden;
  document.querySelector("#saved-button").setAttribute("aria-expanded", String(!panel.hidden));
});

document.querySelector("#saved-close").addEventListener("click", () => {
  document.querySelector("#saved").hidden = true;
  document.querySelector("#saved-button").setAttribute("aria-expanded", "false");
});

document.querySelector("#saved-export").addEventListener("click", () => {
  if (!saved.length) {
    setStatus("No saved words to export.");
    return;
  }
  download("saved-words.json", exportSaved(saved));
  setStatus(`Exported ${saved.length.toLocaleString("en")} saved words.`);
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const found = search(searchInput.value);
  if (found[0]) choose(found[0]);
});

searchInput.addEventListener("input", () => {
  const found = search(searchInput.value);
  results.hidden = found.length === 0;
  results.replaceChildren(...found.map((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<strong></strong><span></span>`;
    button.querySelector("strong").textContent = entry.word;
    button.querySelector("span").textContent = layerById(entry.layer).name;
    button.addEventListener("click", () => choose(entry));
    return button;
  }));
});

document.querySelector("#import-button").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  importFile.value = "";
  if (!file) return;
  applyImport(await file.text(), file.name);
});

document.querySelector("#sample-button").addEventListener("click", async () => {
  const response = await fetch("/import-example.json");
  applyImport(await response.text(), "import-example.json");
});

document.querySelector("#download-button").addEventListener("click", () => {
  download("english-world.json", entries);
  setStatus(`Downloaded ${entries.length.toLocaleString("en")} records.`);
});

document.querySelector("#restore-button").addEventListener("click", () => {
  entries = original.map((entry) => ({ ...entry }));
  world.setEntries(entries);
  renderCensus();
  renderLayers();
  reader.hidden = true;
  setStatus("Restored the 10,000-word test world.");
});

window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", async (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  applyImport(await file.text(), file.name);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") reader.hidden = true;
});

for (const button of document.querySelectorAll("#pad button")) {
  const key = button.dataset.key;
  const press = (down) => world.hold(key, down);
  button.addEventListener("pointerdown", () => press(true));
  button.addEventListener("pointerup", () => press(false));
  button.addEventListener("pointerleave", () => press(false));
}

setInterval(() => {
  region.textContent = world.regionName();
}, 250);
}

function choose(entry) {
  results.hidden = true;
  searchInput.value = entry.word;
  world.focus(entry);
}

function showEntry(entry) {
  const layer = layerById(entry.layer);
  document.querySelector("#reader-kicker").textContent = layer.name;
  document.querySelector("#reader-word").textContent = entry.word;
  document.querySelector("#reader-pos").textContent = entry.pos;
  document.querySelector("#reader-gloss").textContent = entry.gloss;
  const example = document.querySelector("#reader-example");
  example.hidden = !entry.example;
  example.textContent = entry.example ? `“${entry.example}”` : "";
  const note = document.querySelector("#reader-note");
  note.hidden = !entry.note;
  note.textContent = entry.note;
  const rank = entry.rank ? ` Frequency rank ${entry.rank.toLocaleString("en")} in the test list.` : "";
  document.querySelector("#reader-source").textContent = `${sourceLabel(entry)}${rank}`;
  updateSaveButton(entry.word);
  reader.hidden = false;
}

function updateSaveButton(word) {
  const button = document.querySelector("#save-word");
  const on = isSaved(saved, word);
  button.setAttribute("aria-pressed", String(on));
  button.textContent = on ? "Saved" : "Save";
}

function renderSaved() {
  document.querySelector("#saved-count").textContent = saved.length.toLocaleString("en");
  const list = document.querySelector("#saved-list");
  const empty = document.querySelector("#saved-empty");
  empty.hidden = saved.length > 0;
  list.replaceChildren(...saved.map((item) => {
    const row = document.createElement("li");
    const open = document.createElement("button");
    open.type = "button";
    open.className = "open-saved";
    open.textContent = item.word;
    open.addEventListener("click", () => openSaved(item));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      saved = toggleSaved(saved, item);
      writeSaved(localStorage, saved);
      renderSaved();
      updateSaveButton(document.querySelector("#reader-word").textContent);
      setStatus(`Removed ${item.word} from saved words.`);
    });
    row.append(open, remove);
    return row;
  }));
}

function openSaved(item) {
  const live = entries.find((entry) => entry.word.toLowerCase() === item.word.toLowerCase());
  if (live) {
    choose(live);
    return;
  }
  showEntry({
    ...item,
    source: "imported",
    rank: null,
    sample: false,
    id: item.word,
  });
}

function renderCensus() {
  census.textContent = `${entries.length.toLocaleString("en")} words across six lands.`;
}

function renderLayers() {
  layers.replaceChildren(...LAYERS.map((layer) => {
    const count = entries.filter((entry) => entry.layer === layer.id).length;
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-pressed", String(world.visible.get(layer.id)));
    button.innerHTML = `<i class="swatch"></i><span></span>`;
    button.querySelector(".swatch").style.background = layer.color;
    button.querySelector("span").textContent = `${layer.name} · ${count.toLocaleString("en")}`;
    button.addEventListener("click", () => {
      const next = !world.visible.get(layer.id);
      world.setLayerVisible(layer.id, next);
      button.setAttribute("aria-pressed", String(next));
    });
    return button;
  }));
}

function search(query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const exact = [];
  const prefix = [];
  const contains = [];
  for (const entry of entries) {
    const word = entry.word.toLowerCase();
    if (word === needle) exact.push(entry);
    else if (word.startsWith(needle)) prefix.push(entry);
    else if (word.includes(needle)) contains.push(entry);
  }
  return [...exact, ...prefix, ...contains].slice(0, 8);
}

function applyImport(text, name) {
  const { records, errors } = parseImport(text);
  if (!records.length) {
    setStatus(errors[0] || "Nothing in that file could be imported.");
    return;
  }
  if (entries.length + records.length > 25000) {
    setStatus("The world holds up to 25,000 words. Import a smaller file, or restore the test world first.");
    return;
  }
  const merged = mergeRecords(entries, records);
  entries = merged.entries;
  world.setEntries(entries);
  renderCensus();
  renderLayers();
  const problem = errors.length ? ` ${errors[0]}` : "";
  setStatus(`Imported ${name}: ${merged.added.toLocaleString("en")} added, ${merged.updated.toLocaleString("en")} updated.${problem}`);
  if (records[0]) world.focus(entries.find((entry) => entry.word.toLowerCase() === records[0].word.toLowerCase()) || records[0]);
}

function setStatus(message) {
  status.textContent = message;
}

function download(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadLexicon() {
  const response = await fetch("/lexicon.json");
  if (!response.ok) {
    loadingNote.textContent = "The word list could not be opened.";
    throw new Error("lexicon");
  }
  const data = await response.json();
  if (!Array.isArray(data) || data.length < 1000) throw new Error("lexicon shape");
  return data;
}
