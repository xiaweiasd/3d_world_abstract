export const LAYERS = [
  {
    id: "everyday",
    name: "Everyday speech",
    blurb: "The English people actually speak.",
    color: "#e4a15a",
    x: -96,
    z: 42,
    radius: 46,
    raise: 0.2,
    lift: 2.4,
  },
  {
    id: "academic",
    name: "Academic writing",
    blurb: "Research, method, and argument, past the exam list.",
    color: "#7eb6c9",
    x: 78,
    z: 70,
    radius: 40,
    raise: 1.15,
    lift: 3.6,
  },
  {
    id: "literary",
    name: "Literature",
    blurb: "Image, memory, and voice.",
    color: "#e0b1b6",
    x: 92,
    z: -34,
    radius: 38,
    raise: 1.7,
    lift: 6.2,
  },
  {
    id: "faint-concept",
    name: "Faint concepts",
    blurb: "What is easier to feel than to explain.",
    color: "#d9d3c6",
    x: -16,
    z: -88,
    radius: 34,
    raise: 0.45,
    lift: 3.0,
  },
  {
    id: "private-symbol",
    name: "Private symbols",
    blurb: "Marks you can recognize and keep.",
    color: "#e25b45",
    x: -120,
    z: -58,
    radius: 32,
    raise: 0.8,
    lift: 3.8,
  },
  {
    id: "unspoken-framework",
    name: "Unspoken frameworks",
    blurb: "The grammar that holds the other words up.",
    color: "#a79ed4",
    x: 4,
    z: 2,
    radius: 28,
    raise: 2.5,
    lift: 4.4,
  },
];

const LAYER_BY_ID = Object.fromEntries(LAYERS.map((layer) => [layer.id, layer]));

const ALIASES = {
  everyday: "everyday",
  "everyday speech": "everyday",
  academic: "academic",
  "academic writing": "academic",
  literary: "literary",
  literature: "literary",
  "faint concept": "faint-concept",
  "faint concepts": "faint-concept",
  "faint-concept": "faint-concept",
  "private symbol": "private-symbol",
  "private symbols": "private-symbol",
  "private-symbol": "private-symbol",
  symbol: "private-symbol",
  symbols: "private-symbol",
  "unspoken framework": "unspoken-framework",
  "unspoken frameworks": "unspoken-framework",
  "unspoken-framework": "unspoken-framework",
  framework: "unspoken-framework",
  frameworks: "unspoken-framework",
  grammar: "unspoken-framework",
};

export function layerById(id) {
  return LAYER_BY_ID[id];
}

export function resolveLayer(value) {
  if (value == null || String(value).trim() === "") return "faint-concept";
  return ALIASES[String(value).trim().toLowerCase()] ?? null;
}

function clip(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeRecord(raw, index = 0) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Each record must be an object." };
  }
  const word = clip(raw.word, 80);
  if (!word) return { error: "Each record needs a word." };
  const layer = resolveLayer(raw.layer);
  if (!layer) return { error: `Unknown land “${raw.layer}” for “${word}”.` };
  const gloss = clip(raw.gloss, 600) || "Imported word. Add a gloss when you know what it should mean here.";
  return {
    record: {
      id: clip(raw.id, 40) || `import-${index + 1}-${word.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      word,
      layer,
      pos: clip(raw.pos, 40) || "word",
      gloss,
      example: clip(raw.example, 300),
      note: clip(raw.note, 400),
      source: "imported",
      sample: false,
      rank: null,
      landmark: false,
    },
  };
}

export function mergeRecords(current, incoming) {
  const entries = current.map((entry) => ({ ...entry }));
  const indexByWord = new Map();
  entries.forEach((entry, index) => {
    const key = entry.word.toLowerCase();
    if (!indexByWord.has(key)) indexByWord.set(key, index);
  });
  let added = 0;
  let updated = 0;
  for (const record of incoming) {
    const key = record.word.toLowerCase();
    const index = indexByWord.get(key);
    if (index != null) {
      const previous = entries[index];
      entries[index] = {
        ...previous,
        ...record,
        id: previous.id,
        word: previous.word,
        source: "imported",
      };
      updated += 1;
    } else {
      indexByWord.set(key, entries.length);
      entries.push(record);
      added += 1;
    }
  }
  return { entries, added, updated };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ""));
}

function recordsFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const hasHeader = header.includes("word");
  const fields = hasHeader ? header : ["word", "layer", "pos", "gloss", "example", "note"];
  const body = hasHeader ? rows.slice(1) : rows;
  return body.map((cells) => {
    const record = {};
    fields.forEach((field, index) => {
      if (field) record[field] = cells[index] ?? "";
    });
    return record;
  });
}

export function parseImport(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!source) return { errors: ["The file was empty."], records: [] };
  let rawRecords;
  try {
    if (source.startsWith("{") || source.startsWith("[")) {
      const parsed = JSON.parse(source);
      rawRecords = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(rawRecords)) {
        return { errors: ["JSON must be a list of records, or an object with an entries list."], records: [] };
      }
    } else {
      rawRecords = recordsFromCsv(source);
    }
  } catch (error) {
    return { errors: [`Could not read that file. ${error.message}`], records: [] };
  }
  const records = [];
  const errors = [];
  rawRecords.forEach((raw, index) => {
    const result = normalizeRecord(raw, index);
    if (result.error) errors.push(result.error);
    else records.push(result.record);
  });
  if (records.length > 20000) {
    return {
      errors: ["Import is limited to 20,000 records at a time."],
      records: records.slice(0, 20000),
    };
  }
  return { errors: errors.slice(0, 8), records };
}

export function sourceLabel(entry) {
  if (entry.source === "authored") return "Written for this world.";
  if (entry.source === "imported") return "Imported by you.";
  return "Definition from Princeton WordNet.";
}
