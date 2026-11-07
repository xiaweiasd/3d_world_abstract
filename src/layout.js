import { layerById } from "./records.js";

export function hashString(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function layoutEntries(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const list = groups.get(entry.layer) ?? [];
    list.push(entry);
    groups.set(entry.layer, list);
  }
  const positions = new Map();
  for (const [layerId, list] of groups) {
    const layer = layerById(layerId);
    if (!layer) continue;
    list.forEach((entry, index) => {
      const spin = (hashString(entry.word) % 628) / 1000;
      const angle = index * 2.399963229728653 + spin;
      const radius = layer.radius * Math.sqrt((index + 0.5) / list.length) * 0.92;
      const lift = (hashString(entry.id || entry.word) % 1000) / 1000;
      positions.set(entry.id, {
        x: layer.x + Math.cos(angle) * radius,
        y: layer.raise + 0.9 + layer.lift * (0.35 + lift),
        z: layer.z + Math.sin(angle) * radius,
      });
    });
  }
  return positions;
}
