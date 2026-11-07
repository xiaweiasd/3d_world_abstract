#!/usr/bin/env python3
"""Build the 10,000-word test lexicon for the English world.

Common meanings come from Princeton WordNet. Words are ordered with the
google-10000-english frequency list. Closed-class words that WordNet does not
define as function words are written in this file. Notes on the private-symbol
and unspoken-framework lands are sample readings, meant to be replaced by import.
"""

from __future__ import annotations

import json
import re
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "cache"
OUT = ROOT / "public" / "lexicon.json"
FREQ_URL = "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-usa-no-swears.txt"
TARGET = 10000

# Caps, not a demand to invent words. Everyday absorbs whatever is left
# so the world still holds 10,000 real records.
QUOTA = {
    "everyday": 7000,
    "academic": 2000,
    "literary": 1500,
    "faint-concept": 800,
    "private-symbol": 1100,
    "unspoken-framework": 420,
}
LAYER_ORDER = list(QUOTA)

LANDMARKS = {
    "everyday": ["home", "water", "friend", "voice", "bread", "road", "window", "morning"],
    "academic": ["analysis", "theory", "evidence", "method", "context", "structure", "research", "principle"],
    "literary": ["metaphor", "silence", "shadow", "memory", "winter", "river", "grief", "mercy"],
    "faint-concept": ["nuance", "glimmer", "hush", "dusk", "whisper", "ache", "trace", "mood"],
    "private-symbol": ["key", "mirror", "door", "thread", "mask", "map", "ring", "lamp"],
    "unspoken-framework": ["grammar", "tense", "sentence", "clause", "tone", "meaning", "word", "story"],
}
LANDMARKS_OF = {word: layer for layer, words in LANDMARKS.items() for word in words}

LANDMARK_NOTES = {
    "key": "Sample symbol. The word you hold when a door in the language is yours to open.",
    "mirror": "Sample symbol. What the sentence shows you after you have said it.",
    "door": "Sample symbol. The place a conversation either lets you in or keeps you at the step.",
    "thread": "Sample symbol. The line you follow back through a page to the sentence that mattered.",
    "mask": "Sample symbol. The face a word wears in company.",
    "map": "Sample symbol. A private chart of which words stand next to each other.",
    "ring": "Sample symbol. A closed mark. What it circles is not written down.",
    "lamp": "Sample symbol. The word you light when the rest of the sentence is still dark.",
    "grammar": "Sample framework. The agreements that let one word trust the next.",
    "tense": "Sample framework. Where a sentence puts itself in time, often without anyone naming the choice.",
    "sentence": "Sample framework. The smallest whole dwelling in this language.",
    "clause": "Sample framework. A room inside the sentence, with its own subject and its own weather.",
    "tone": "Sample framework. The stance that changes the meaning while the words stay still.",
    "meaning": "Sample framework. What speakers think they share, and what they quietly do not.",
    "word": "Sample framework. The unit English pretends is solid, though its edges move.",
    "story": "Sample framework. The order that makes events feel as if they had to happen.",
    "nuance": "Faint concept. A difference small enough to miss, and large enough to change the sentence.",
    "glimmer": "Faint concept. Light, or understanding, that arrives before it is certain.",
    "hush": "Faint concept. The quiet that is made, not merely the absence of noise.",
    "dusk": "Faint concept. The hour when shapes remain and names begin to fail.",
    "whisper": "Faint concept. Speech meant to cross a short distance and no further.",
    "ache": "Faint concept. A pain that stays dull so it can last.",
    "trace": "Faint concept. What remains when the thing itself has gone.",
    "mood": "Faint concept. The weather inside a person, or inside a paragraph.",
}

AUTHORED = {
    "the": ("determiner", "The definite article. It singles out a particular thing the listener can identify.", "The door was already open."),
    "a": ("determiner", "The indefinite article used before a consonant sound for one non-specific thing.", "A word can hold a whole room."),
    "an": ("determiner", "The indefinite article used before a vowel sound.", "An hour passed without a sentence."),
    "of": ("preposition", "A preposition of belonging, measure, and relation.", "The color of the evening changed."),
    "and": ("conjunction", "A coordinating conjunction that joins equal words, phrases, or clauses.", "Bread and salt were on the table."),
    "to": ("preposition", "A preposition of direction, and the marker of the infinitive.", "She went to the window to listen."),
    "in": ("preposition", "A preposition of containment, place, or a period of time.", "The key was in the drawer."),
    "for": ("preposition", "A preposition of purpose, recipient, or duration.", "We waited for the answer."),
    "on": ("preposition", "A preposition of surface contact, support, or a day.", "The book lay on the step."),
    "with": ("preposition", "A preposition of accompaniment, instrument, or manner.", "She wrote with a blunt pencil."),
    "at": ("preposition", "A preposition of a point in place or time.", "Meet me at the gate."),
    "by": ("preposition", "A preposition of agent, means, or proximity.", "The letter was sent by hand."),
    "from": ("preposition", "A preposition of source, origin, or separation.", "A voice came from the next room."),
    "as": ("conjunction", "A word of role, comparison, or simultaneous time.", "As the light failed, the story began."),
    "that": ("determiner", "A demonstrative, and the conjunction that introduces a clause.", "That sentence is the one that matters."),
    "this": ("determiner", "A demonstrative for something near the speaker.", "This word stays."),
    "these": ("determiner", "The plural demonstrative for things near the speaker.", "These pages belong together."),
    "those": ("determiner", "The plural demonstrative for things farther from the speaker.", "Those years were quieter."),
    "it": ("pronoun", "A pronoun for a thing, a situation, or a clause already in play.", "It can wait until morning."),
    "if": ("conjunction", "A conjunction that opens a condition.", "If you say it twice, it changes."),
    "because": ("conjunction", "A conjunction that gives a cause.", "She left because the room had gone cold."),
    "although": ("conjunction", "A conjunction that concedes one fact and then turns.", "Although the road was dark, she knew the turn."),
    "or": ("conjunction", "A coordinating conjunction that offers an alternative.", "Tea or water."),
    "but": ("conjunction", "A coordinating conjunction that sets up a contrast.", "The door was shut, but the lamp was lit."),
    "not": ("adverb", "Negation. It reverses the claim it attaches to.", "This is not the same word."),
    "into": ("preposition", "A preposition of movement to the inside.", "She walked into the sentence."),
    "about": ("preposition", "A preposition of topic, or of rough measure.", "A story about winter."),
    "than": ("conjunction", "The conjunction used after a comparative.", "Quieter than snow."),
    "there": ("adverb", "An adverb of a place away from the speaker, and the empty subject of existence.", "There is a light in the window."),
    "here": ("adverb", "An adverb of the speaker's place.", "The word is here."),
    "what": ("pronoun", "An interrogative and relative pronoun for things and situations.", "What did the silence mean?"),
    "which": ("pronoun", "An interrogative and relative pronoun that picks among known things.", "The road which follows the river."),
    "who": ("pronoun", "An interrogative and relative pronoun for people.", "The friend who kept the key."),
    "how": ("adverb", "An interrogative adverb of manner or degree.", "How does the sentence turn?"),
    "when": ("adverb", "An interrogative and conjunction of time.", "When the dusk arrived, we stopped."),
    "where": ("adverb", "An interrogative and conjunction of place.", "Where the road bends."),
    "during": ("preposition", "A preposition covering a span of time.", "During the pause, nobody moved."),
    "among": ("preposition", "A preposition of being in the midst of a group.", "One true word among many."),
    "without": ("preposition", "A preposition of absence or lack.", "A map without names."),
    "toward": ("preposition", "A preposition of direction in relation to something.", "She turned toward the voice."),
    "is": ("verb", "The third-person singular present of be.", "The lamp is still lit."),
    "are": ("verb", "The plural and second-person present of be.", "The words are already in the room."),
    "was": ("verb", "The first- and third-person singular past of be.", "The road was empty."),
    "were": ("verb", "The plural and second-person past of be.", "They were quiet."),
    "am": ("verb", "The first-person singular present of be.", "I am here."),
    "been": ("verb", "The past participle of be.", "She has been waiting."),
    "being": ("verb", "The present participle of be.", "Being early, he waited."),
    "be": ("verb", "The copula. It links a subject to what it is, and it forms the passive and the progressive.", "Be still."),
    "have": ("verb", "The verb of possession, and the auxiliary of the perfect.", "They have left the key."),
    "has": ("verb", "The third-person singular present of have.", "She has the map."),
    "had": ("verb", "The past of have.", "He had already spoken."),
    "do": ("verb", "The verb of action, and the auxiliary of questions, emphasis, and negation.", "Do you hear it?"),
    "does": ("verb", "The third-person singular present of do.", "Does the sentence turn here?"),
    "did": ("verb", "The past of do.", "She did not answer."),
    "will": ("verb", "The auxiliary of the future, and of willingness.", "The morning will come."),
    "would": ("verb", "The past of will, also used for hypothetical futures.", "I would wait."),
    "can": ("verb", "The auxiliary of ability or permission.", "She can read the faint word."),
    "could": ("verb", "The past of can, also used for tentative possibility.", "We could leave at dusk."),
    "may": ("verb", "The auxiliary of possibility or permission.", "You may begin."),
    "might": ("verb", "A tentative auxiliary of possibility.", "It might rain."),
    "shall": ("verb", "A formal auxiliary of the future, or of obligation.", "We shall see."),
    "should": ("verb", "The auxiliary of advice, expectation, or duty.", "You should say it plainly."),
    "must": ("verb", "The auxiliary of necessity or strong probability.", "The key must be here."),
    "i": ("pronoun", "The first-person singular pronoun.", "I kept the word."),
    "you": ("pronoun", "The second-person pronoun.", "You already know the turn."),
    "we": ("pronoun", "The first-person plural pronoun.", "We crossed the river."),
    "he": ("pronoun", "The third-person singular pronoun for a male person, or for someone referred to as he.", "He closed the door."),
    "she": ("pronoun", "The third-person singular pronoun for a female person, or for someone referred to as she.", "She kept the lamp."),
    "they": ("pronoun", "The third-person plural pronoun, also used for a person whose pronoun is they.", "They were late."),
    "me": ("pronoun", "The object form of I.", "Tell me the name."),
    "him": ("pronoun", "The object form of he.", "The letter was for him."),
    "her": ("pronoun", "The object form of she, and the possessive determiner.", "Her voice was low."),
    "us": ("pronoun", "The object form of we.", "Walk with us."),
    "them": ("pronoun", "The object form of they.", "We thanked them."),
    "my": ("determiner", "The possessive determiner for I.", "My key is missing."),
    "your": ("determiner", "The possessive determiner for you.", "Your turn."),
    "his": ("determiner", "The possessive determiner for he.", "His coat was on the chair."),
    "its": ("determiner", "The possessive determiner for it.", "The town and its river."),
    "our": ("determiner", "The possessive determiner for we.", "Our window faces east."),
    "their": ("determiner", "The possessive determiner for they.", "Their story changed."),
    "all": ("determiner", "A quantifier for the whole of a group or mass.", "All the doors were shut."),
    "more": ("determiner", "A comparative quantifier: a greater amount or number.", "More light, please."),
    "most": ("determiner", "A superlative quantifier: the greatest amount or number.", "Most of the words were old."),
    "some": ("determiner", "A quantifier for an unspecified amount or number.", "Some silence is useful."),
    "any": ("determiner", "A quantifier for one or some, of whatever kind, often in questions and negatives.", "Any word will do."),
    "no": ("determiner", "A quantifier meaning not any.", "No answer came."),
    "other": ("adjective", "Not the same one already mentioned.", "The other road."),
    "up": ("adverb", "A particle of direction toward a higher place, or of completion.", "She looked up."),
    "out": ("adverb", "A particle of direction away from the inside, or of completion.", "The lamp went out."),
    "so": ("adverb", "A word of degree, result, or agreement.", "It was so quiet."),
    "just": ("adverb", "A word of exactness, recency, or mere-ness.", "She had just arrived."),
    "only": ("adverb", "A word that limits a claim to one thing and no more.", "Only the river moved."),
    "also": ("adverb", "A word that adds something of the same kind.", "The window was also open."),
    "very": ("adverb", "An intensifier of degree.", "A very small key."),
    "too": ("adverb", "An intensifier meaning more than enough, or meaning also.", "Too late, and too loud."),
    "then": ("adverb", "An adverb of time after that, or of consequence.", "Then the story turned."),
    "despite": ("preposition", "A preposition of concession: in spite of.", "Despite the dark, she walked."),
}

FRAMEWORK_WORDS = set(AUTHORED) | {
    "however", "therefore", "moreover", "nevertheless", "thus", "hence", "whereas",
    "furthermore", "meanwhile", "otherwise", "instead", "indeed", "perhaps",
    "between", "before", "after", "above", "below", "under", "over", "through",
    "within", "across", "against", "until", "unless", "since", "while", "whether",
    "grammar", "syntax", "tense", "clause", "sentence", "meaning", "word", "story",
    "tone", "aspect", "register", "discourse", "pronoun", "preposition",
    "conjunction", "article", "adverb", "noun", "verb",
}

ACADEMIC = {
    "analysis", "approach", "assessment", "assume", "authority", "benefit", "concept",
    "consistent", "context", "contract", "data", "definition", "derived", "distribution",
    "economic", "environment", "established", "estimate", "evidence", "factor", "factors",
    "financial", "formula", "function", "hypothesis", "identified", "income", "indicate",
    "individual", "interpretation", "involved", "issue", "issues", "legal", "legislation",
    "method", "occur", "percent", "period", "policy", "principle", "procedure", "process",
    "required", "research", "response", "role", "section", "sector", "significant",
    "similar", "source", "specific", "structure", "theory", "variable", "variables",
    "achieve", "acquisition", "administration", "affect", "appropriate", "aspect",
    "aspects", "category", "categories", "commission", "complex", "conclusion", "conduct",
    "consequence", "consequences", "construction", "consumer", "credit", "cultural",
    "design", "distinction", "element", "elements", "equation", "evaluation", "feature",
    "features", "focus", "impact", "institute", "investment", "journal", "maintenance",
    "participation", "perceived", "potential", "previous", "primary", "range", "region",
    "regulation", "regulations", "relevant", "resource", "resources", "strategy",
    "strategies", "survey", "traditional", "transfer", "alternative", "circumstance",
    "circumstances", "compensation", "component", "components", "consent", "considerable",
    "constant", "constraint", "constraints", "contribution", "convention", "coordination",
    "core", "corporate", "corresponding", "criteria", "deduction", "demonstrate",
    "document", "dominant", "emphasis", "ensure", "framework", "illustrated", "implies",
    "initial", "instance", "interaction", "justification", "layer", "location", "maximum",
    "negative", "outcome", "outcomes", "partnership", "philosophy", "proportion",
    "published", "reaction", "reliance", "scheme", "sequence", "specified", "sufficient",
    "task", "technical", "technique", "techniques", "technology", "validity", "volume",
    "adequate", "annual", "apparent", "attitude", "attitudes", "commitment",
    "communication", "concentration", "conference", "contrast", "cycle", "debate",
    "dimension", "dimensions", "domestic", "ethnic", "granted", "hence", "implementation",
    "implication", "implications", "integration", "internal", "investigation", "mechanism",
    "obvious", "option", "output", "overall", "parallel", "parameter", "parameters",
    "phase", "predicted", "principal", "prior", "professional", "project", "promote",
    "regime", "resolution", "series", "statistics", "status", "subsequent", "summary",
    "academic", "adjustment", "amendment", "capacity", "challenge", "conflict",
    "consultation", "decline", "discretion", "enable", "enforcement", "equivalent",
    "evolution", "expansion", "exposure", "external", "facilitate", "fundamental",
    "generation", "logic", "marginal", "medical", "mental", "modified", "monitoring",
    "network", "notion", "objective", "orientation", "perspective", "precise",
    "psychology", "ratio", "revenue", "stability", "sustainable", "symbolic", "target",
    "transition", "trend", "version", "whereas", "abstract", "accurate", "aggregate",
    "allocation", "diversity", "domain", "explicit", "flexibility", "furthermore",
    "gender", "incentive", "incidence", "index", "initiative", "initiatives", "input",
    "intelligence", "interval", "lecture", "migration", "minimum", "motivation",
    "neutral", "nevertheless", "rational", "recovery", "scope", "transformation",
    "underlying", "utility", "adaptation", "comprehensive", "comprise", "contrary",
    "definite", "dynamic", "empirical", "finite", "foundation", "global", "guarantee",
    "identical", "ideology", "inferred", "innovation", "intervention", "isolated",
    "paradigm", "phenomenon", "priority", "publication", "simulation", "successive",
    "thesis", "topic", "transmission", "ultimately", "unique", "voluntary",
    "methodology", "coefficient", "correlation", "qualitative", "quantitative",
    "ontology", "epistemology", "taxonomy", "reliability", "criterion", "bias",
    "causal", "cohort", "citation", "discourse", "ethics", "heuristic", "inference",
    "longitudinal", "meta-analysis", "normative", "peer", "qualitative", "sampling",
    "validity", "variance", "conceptual", "empirical", "theoretical",
}

LITERARY = {
    "metaphor", "simile", "irony", "allegory", "elegy", "sonnet", "stanza", "cadence",
    "lyric", "myth", "fable", "verse", "prose", "narrative", "imagery", "omen",
    "lament", "soliloquy", "alliteration", "rhyme", "protagonist", "antagonist",
    "motif", "trope", "diction", "silence", "shadow", "memory", "grief", "mercy",
    "threshold", "dusk", "ash", "bloom", "witness", "longing", "reverie", "ballad",
    "ode", "epic", "pastoral", "tragedy", "comedy", "satire", "parable", "symbolism",
    "persona", "narrator", "couplet", "quatrain", "iamb", "caesura",
    "enjambment", "allusion", "apostrophe", "hyperbole", "litotes", "oxymoron",
    "paradox", "personification", "synecdoche", "metonymy", "folklore", "legend",
    "saga", "chronicle", "memoir", "dirge", "requiem", "nocturne", "twilight",
    "solitude", "sorrow", "tenderness", "winter", "river", "elegiac", "imagery",
    "sonnet", "villanelle", "sestina", "freeverse", "scansion", "anapest",
    "dactyl", "trochee", "pentameter", "hexameter", "epigraph", "foreword", "canto",
    "stanza", "refrain", "monologue",
    "climax", "denouement", "foil", "hubris", "catharsis", "hamartia", "tragic",
    "lyricism", "poetic", "poet", "poem", "novel", "novella", "essay",
}

ACADEMIC_CUES = (
    "scientific", "in mathematics", "in logic", "in philosophy", "in law",
    "in economics", "in linguistics", "hypothesis", "statistical", "methodology",
    "theoretical", "coefficient", "taxonomy", "a theory that",
)
LITERARY_CUES = (
    "poem", "poetry", "literary", "figure of speech", "verse", "elegy", "sonnet",
    "a narrative", "in literature", "in poetry", "mythology", "a drama",
)
FAINT_CUES = ("subtle", "vague", "faint", "barely", "fleeting", "wistful", "melanchol", "nostalg")
FRAME_CUES = ("grammatical", "in grammar", "syntactic", "part of speech", "a conjunction", "a preposition", "morpheme")
BAD_DEF = ("of the genus", "of the family", "a city in", "a town in", "capital of", "a river in", "a state in", "born ")
POS = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
EVERYDAY_LEX = {
    "noun.food", "noun.time", "noun.artifact", "noun.act", "noun.state", "noun.body",
    "noun.object", "noun.substance", "noun.event", "noun.quantity", "verb.motion",
    "verb.perception", "verb.emotion", "verb.communication", "verb.social", "adj.all",
}

SYMBOL_PATTERNS = [
    "Sample symbol. {W} is a mark you recognize and do not translate.",
    "Sample symbol. Carry {w} as a private sign. The public definition can stay outside.",
    "Sample symbol. {W} stands for one private meaning. You do not owe the explanation.",
    "Sample symbol. Use {w} when the thing appears, then leave it unnamed beyond the mark.",
    "Sample symbol. In your world, {w} is kept rather than defined.",
    "Sample symbol. {W} is the sign you notice and other people walk past.",
    "Sample symbol. Let {w} point at something you will not put in a glossary.",
    "Sample symbol. {W} belongs to the private margin of the page.",
    "Sample symbol. Repeat {w} only to yourself.",
    "Sample symbol. {W} is a handle for a meaning that stays in the hand.",
    "Sample symbol. When {w} appears, the rest of the sentence can wait.",
    "Sample symbol. {W} is yours to place, and yours to withhold.",
]
FRAMEWORK_PATTERNS = [
    "Sample framework. {W} holds other words in place, even when nobody names it.",
    "Sample framework. Speakers use {w} to arrange a sentence before they describe the arrangement.",
    "Sample framework. Leave {w} unsaid and the structure can remain.",
    "Sample framework. {W} is part of the grammar English rarely stops to point at.",
    "Sample framework. {W} decides how the nearby words are allowed to stand.",
    "Sample framework. The work of {w} is finished before anyone asks what it means.",
    "Sample framework. {W} is a joint in the sentence, not the furniture.",
    "Sample framework. People hear {w} as structure, not as a topic.",
    "Sample framework. {W} keeps a relation that the content words depend on.",
    "Sample framework. Explain {w} and you are already outside the agreement it makes.",
    "Sample framework. {W} is the quiet rule under the louder words.",
    "Sample framework. A world of English needs {w} the way a room needs a floor.",
]


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return
    print(f"downloading {url}")
    urllib.request.urlretrieve(url, dest)


def ensure_wordnet():
    import nltk
    from nltk.corpus import wordnet as wn

    try:
        wn.synsets("bread")
    except LookupError:
        nltk.download("wordnet", quiet=True)
        nltk.download("omw-1.4", quiet=True)
    return wn


def fnv(text: str) -> int:
    number = 2166136261
    for char in text:
        number ^= ord(char)
        number = (number * 16777619) & 0xFFFFFFFF
    return number


def clean(text: str) -> str:
    return " ".join(text.split())


def usable(word: str) -> bool:
    return word.isalpha() and 3 <= len(word) <= 16 and any(char in "aeiou" for char in word)


def has_any(text: str, cues: tuple[str, ...] | set[str]) -> bool:
    return any(re.search(rf"\b{re.escape(cue)}\b", text) for cue in cues)


def bad_definition(text: str) -> bool:
    return has_any(text, BAD_DEF)


def note_for(word: str, layer: str, source: str) -> str:
    if LANDMARKS_OF.get(word) == layer and word in LANDMARK_NOTES:
        return LANDMARK_NOTES[word]
    if layer == "private-symbol":
        pattern = SYMBOL_PATTERNS[fnv(word) % len(SYMBOL_PATTERNS)]
        return pattern.format(w=word, W=word.capitalize())
    if layer == "unspoken-framework" and source != "authored":
        pattern = FRAMEWORK_PATTERNS[fnv(word) % len(FRAMEWORK_PATTERNS)]
        return pattern.format(w=word, W=word.capitalize())
    return ""


def make_record(word: str, layer: str, pos: str, gloss: str, example: str, source: str, rank: int | None) -> dict:
    note = note_for(word, layer, source)
    return {
        "word": word,
        "layer": layer,
        "pos": pos,
        "gloss": gloss,
        "example": example,
        "note": note,
        "source": source,
        "sample": note.startswith("Sample"),
        "rank": rank,
        "landmark": LANDMARKS_OF.get(word) == layer,
    }


SKIP_LEX = {"noun.person", "noun.plant"}


def choose_synset(wn, word: str, rank: int | None):
    synsets = wn.synsets(word)
    if not synsets:
        return None
    usable_synsets = [synset for synset in synsets if synset.lexname() not in SKIP_LEX]
    if not usable_synsets:
        usable_synsets = synsets
    if rank is not None and rank <= 2000:
        ordinary = [
            synset for synset in usable_synsets
            if synset.lexname() not in {"noun.quantity", "noun.substance"}
        ]
        if ordinary:
            usable_synsets = ordinary
    prefer = {"good": "a", "know": "v", "new": "a", "see": "v", "get": "v", "make": "v", "go": "v", "say": "v", "free": "a"}.get(word)
    if prefer:
        for synset in usable_synsets:
            if synset.pos() == prefer or (prefer == "a" and synset.pos() == "s"):
                return synset
    return usable_synsets[0]


def from_synset(wn_syn, word: str, layer: str, rank: int | None) -> dict | None:
    gloss = clean(wn_syn.definition())
    if len(gloss) < 8 or bad_definition(gloss.lower()):
        return None
    example = clean(wn_syn.examples()[0])[:180] if wn_syn.examples() else ""
    return make_record(word, layer, POS[wn_syn.pos()], gloss, example, "wordnet", rank)


def preferred(word: str, rank: int, syn) -> str:
    lexname = syn.lexname()
    gloss = syn.definition().lower()
    if word in FRAMEWORK_WORDS or has_any(gloss, FRAME_CUES):
        return "unspoken-framework"
    if syn.lexname() != "noun.person" and (word in LITERARY or has_any(gloss, LITERARY_CUES)):
        return "literary"
    if word in ACADEMIC or has_any(gloss, ACADEMIC_CUES):
        return "academic"
    if lexname == "noun.feeling" and rank > 1400:
        return "faint-concept"
    if lexname == "noun.attribute" and rank > 2500 and has_any(gloss, FAINT_CUES):
        return "faint-concept"
    if lexname == "noun.artifact" and rank > 1100:
        return "private-symbol"
    return "everyday"


def main() -> None:
    wn = ensure_wordnet()
    download(FREQ_URL, CACHE / "google-10000-english.txt")
    freq = []
    seen = set()
    for line in (CACHE / "google-10000-english.txt").read_text(encoding="utf-8").splitlines():
        word = line.strip().lower()
        if word and word not in seen:
            seen.add(word)
            freq.append(word)
    rank_of = {word: index + 1 for index, word in enumerate(freq)}

    records: dict[str, dict] = {}
    counts: Counter[str] = Counter()

    def room(layer: str) -> bool:
        return counts[layer] < QUOTA[layer]

    def place(record: dict | None) -> bool:
        if record is None or record["word"] in records or len(records) >= TARGET or not room(record["layer"]):
            return False
        records[record["word"]] = record
        counts[record["layer"]] += 1
        return True

    missing = []
    for layer, words in LANDMARKS.items():
        for word in words:
            synsets = wn.synsets(word.replace(" ", "_"))
            if not synsets:
                missing.append(word)
                continue
            place(from_synset(synsets[0], word, layer, rank_of.get(word)))

    for word, (pos, gloss, example) in AUTHORED.items():
        if word in records:
            continue
        place(make_record(word, "unspoken-framework", pos, gloss, example, "authored", rank_of.get(word)))

    QUOTA["everyday"] = 5200
    for word in freq:
        if word in records or not usable(word):
            continue
        rank = rank_of[word]
        synset = choose_synset(wn, word, rank)
        if synset is None:
            continue
        layer = preferred(word, rank, synset)
        placed = place(from_synset(synset, word, layer, rank))
        if not placed and layer != "everyday":
            place(from_synset(synset, word, "everyday", rank))

    headwords = []
    for synset in wn.all_synsets():
        lemma = synset.lemmas()[0].name().lower()
        if "_" in lemma or not usable(lemma) or lemma in records:
            continue
        gloss = synset.definition().lower()
        if bad_definition(gloss):
            continue
        headwords.append((lemma, synset, gloss))
    headwords.sort(key=lambda item: item[0])

    def take(layer: str, predicate) -> None:
        for lemma, synset, gloss in headwords:
            if not room(layer):
                return
            if lemma in records:
                continue
            if predicate(lemma, synset, gloss):
                place(from_synset(synset, lemma, layer, rank_of.get(lemma)))

    literary_marks = LITERARY_CUES + ("story", "tale", "novel", "song", "drama", "fiction", "a play", "poem")
    take("faint-concept", lambda lemma, synset, gloss: synset.lexname() in {"noun.feeling", "verb.emotion", "noun.motive"} or (synset.pos() in {"a", "s"} and has_any(gloss, FAINT_CUES)) or (synset.lexname() == "noun.attribute" and "feeling" in gloss))
    take("unspoken-framework", lambda lemma, synset, gloss: lemma in FRAMEWORK_WORDS or has_any(gloss, FRAME_CUES + ("syntax", "morphology", "phonology", "semantics", "linguistics", "inflection")))
    take("literary", lambda lemma, synset, gloss: synset.lexname() != "noun.person" and (lemma in LITERARY or has_any(gloss, literary_marks) or (synset.lexname() == "noun.communication" and has_any(gloss, literary_marks))))
    take("academic", lambda lemma, synset, gloss: lemma in ACADEMIC or has_any(gloss, ACADEMIC_CUES) or synset.lexname() in {"noun.cognition", "verb.cognition", "noun.process"})
    take("private-symbol", lambda lemma, synset, gloss: synset.lexname() == "noun.artifact" and 3 <= len(lemma) <= 12)
    # Whatever remains of the 10,000 is ordinary English: shorter, familiar words first.
    QUOTA["everyday"] = TARGET
    headwords.sort(key=lambda item: (item[0] not in rank_of, len(item[0]), item[0]))
    take("everyday", lambda lemma, synset, gloss: synset.lexname() in EVERYDAY_LEX or synset.pos() in {"a", "s", "r", "v"})

    if sum(counts.values()) != TARGET:
        raise SystemExit(f"expected {TARGET} records, built {sum(counts.values())} {dict(counts)}")

    ordered = []
    for layer in LAYER_ORDER:
        layer_records = [rec for rec in records.values() if rec["layer"] == layer]
        layer_records.sort(key=lambda rec: (rec["rank"] is None, rec["rank"] or 10**9, rec["word"]))
        ordered.extend(layer_records)
    for index, rec in enumerate(ordered, start=1):
        rec["id"] = f"en-{index:05d}"

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(ordered, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote", OUT, "bytes", OUT.stat().st_size)
    for layer in LAYER_ORDER:
        print(f"  {layer}: {counts[layer]}")
    if missing:
        print("missing landmarks:", ", ".join(missing))

    by_layer: dict[str, list[dict]] = {layer: [] for layer in LAYER_ORDER}
    for rec in ordered:
        by_layer[rec["layer"]].append(rec)
    for layer in LAYER_ORDER:
        print(f"\n[{layer}]")
        for rec in by_layer[layer][:6]:
            print(f"  {rec['word']:16} {rec['pos']:12} {rec['gloss'][:88]}")

    checks = {
        "bread": ("everyday", "baked"),
        "metaphor": ("literary", "figure of speech"),
        "grammar": ("unspoken-framework", "syntax"),
        "door": ("private-symbol", "entrance"),
        "dusk": ("faint-concept", "sunset"),
        "the": ("unspoken-framework", "article"),
        "analysis": ("academic", "investigation"),
    }
    lookup = {rec["word"]: rec for rec in ordered}
    for word, (layer, fragment) in checks.items():
        rec = lookup.get(word)
        if rec is None or rec["layer"] != layer or fragment not in rec["gloss"].lower():
            raise SystemExit(f"check failed for {word}: {rec}")
    print("\nchecks ok")


if __name__ == "__main__":
    main()
