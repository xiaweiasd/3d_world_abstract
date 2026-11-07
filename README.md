# An English World

A small 3D world of English, larger than an exam list. Ten thousand test words already stand on six lands, and you can import your own.

The lands:

- **Everyday speech** — words people actually use.
- **Academic writing** — research, method, and argument, past the IELTS topic list.
- **Literature** — image, memory, and voice.
- **Faint concepts** — words for what is easier to feel than to explain.
- **Private symbols** — marks you can recognize and keep. The notes here are samples.
- **Unspoken frameworks** — the grammar that holds the other words up. Closed-class words are written for this world. Other notes are samples for you to replace.

Public definitions come from Princeton WordNet. See `NOTICE`.

## Run

```bash
npm install
npm run dev
```

Open the address Vite prints. `npm test` checks the lexicon and the import rules. `npm run build` writes `dist/`.

## Move

Drag to look. WASD moves. Q rises, E falls, Shift is faster. Click a word to read it. The round map at the lower right jumps you across the water. Search flies to a word.

## Saved words

On an open word, choose **Save**. The collection stays in this browser’s localStorage. **Saved** lists them. **Export saved words** downloads `saved-words.json`, in the same shape as an import. Saving the word again, or choosing **Remove**, takes it out.

## Import

Choose **Import**, or drop a `.json` or `.csv` file on the window. A missing land becomes Faint concepts. Unknown land names are skipped.

JSON:

```json
[
  {
    "word": "afterlight",
    "layer": "faint-concept",
    "pos": "noun",
    "gloss": "The brightness that stays in a room after the lamp is out.",
    "example": "We spoke in the afterlight.",
    "note": "Mine."
  }
]
```

Lands you can name: `everyday`, `academic`, `literary`, `faint-concept`, `private-symbol`, `unspoken-framework`.

CSV, with a header:

```csv
word,layer,pos,gloss,example,note
afterlight,faint-concept,noun,The brightness that stays after the lamp is out.,We spoke in the afterlight.,Mine.
```

**Add 3 of mine** drops three private records into the world so you can see an import move. **Download** saves whatever is standing there now. **Restore test world** brings back the original 10,000.

`npm run lexicon` rebuilds `public/lexicon.json` from WordNet. That step needs Python and network access the first time.
