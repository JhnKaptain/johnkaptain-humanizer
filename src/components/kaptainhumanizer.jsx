import React, { useState } from "react";

/**
 * JohnKaptain — Kaptain AI Humanizer (Detector-aware, Heavy Paraphrase)
 * --------------------------------------------------------------------
 * Goals:
 *  - Rewrite strongly (lexical + structural) while preserving meaning.
 *  - Break AI cues: uniform pacing, stock transitions, passive chains, “there is/are”,
 *    over-formality, repeated n-grams, predictable clause order, etc.
 *  - Heuristic AI check emphasizes: sentence length variety, repetition/uniqueness,
 *    discourse markers, average word length, comma density, and phrase stock.
 *
 * UI:
 *  - Input capped at 1000 words (hard cap while typing/pasting).
 *  - Output always visible; Copy / Reset live below output.
 *  - “Human% • AI%” shows ONLY after Humanize or Check AI.
 */

/* ============================ Basic helpers ================================= */

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const rand = (n) => Math.floor(Math.random() * n);
const chance = (p) => Math.random() < clamp01(p);
const WORD_RE = /[A-Za-z0-9][A-Za-z0-9'-]*/g;

const title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const lc = (s) => (s ? s.toLowerCase() : s);

function wordCount(text) {
  return (text.match(WORD_RE) || []).length;
}
function capToWords(text, maxWords) {
  if (!text) return "";
  let count = 0;
  let lastEnd = 0;
  const re = new RegExp(WORD_RE, "g");
  let m;
  while ((m = re.exec(text)) !== null) {
    count++;
    lastEnd = m.index + m[0].length;
    if (count >= maxWords) break;
  }
  if (count < maxWords) return text;
  return text.slice(0, lastEnd);
}
function escapeHTML(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function stripHTML(s) {
  const div = document.createElement("div");
  div.innerHTML = s;
  return div.textContent || div.innerText || "";
}

/* ============================ Linguistic data =============================== */

const STOP = new Set([
  "the","a","an","and","or","but","if","then","when","while","of","to","in","on","for","as","by","at",
  "from","with","about","into","over","after","before","between","through","during","above","below",
  "up","down","out","off","again","further","here","there","all","any","both","each","few","more","most",
  "other","some","such","no","nor","not","only","own","same","so","than","too","very","can","will","just",
  "should","now","is","am","are","was","were","be","been","being","it","its","they","them","their","we",
  "our","you","your","i","he","him","his","she","her","hers","this","that","these","those"
]);

const STOCK_OPENERS = [
  "in conclusion", "in summary", "in addition", "moreover", "furthermore", "overall",
  "to conclude", "to summarize", "additionally", "as a result", "therefore", "however"
];

const SIMPLE = {
  approximately: "about",
  numerous: "many",
  sufficient: "enough",
  facilitate: "help",
  subsequently: "later",
  prior: "before",
  subsequent: "after",
  acquire: "get",
  purchase: "buy",
  demonstrate: "show",
  utilize: "use",
  commence: "begin",
  conclude: "finish",
  objective: "goal",
  objectives: "goals",
  methodology: "method",
  methodologies: "methods",
  endeavor: "effort",
  attempt: "try",
  therefore: "so",
  however: "but",
  moreover: "also",
  furthermore: "also",
  consequently: "so",
  regarding: "about",
  obtain: "get",
  assist: "help",
  maintain: "keep",
  ensure: "make sure",
  favorable: "good",
  feasible: "possible",
  leverage: "use",
  indicates: "shows",
  illustrate: "show",
  aforementioned: "mentioned",
  optimal: "best possible",
  paramount: "most important",
  ascertain: "find out",
  mitigate: "reduce",
  explicate: "explain",
  explicates: "explains",
  explicated: "explained",
  comprehension: "understanding",
  individuals: "people",
  components: "parts",
  implementation: "application",
  implement: "apply",
  prioritize: "focus on",
  adequate: "enough",
  insufficient: "not enough",
  nevertheless: "even so",
  notwithstanding: "despite",
  consequently_: "so",
};

const SYN = {
  important: ["crucial","vital","essential","significant","key"],
  advantage: ["benefit","upside","plus"],
  disadvantage: ["drawback","downside","limitation"],
  impact: ["effect","influence","reach"],
  improve: ["enhance","boost","strengthen","refine"],
  improvement: ["enhancement","gain","upgrade","advance"],
  show: ["reveal","indicate","demonstrate","display","exhibit"],
  result: ["outcome","effect","consequence","upshot"],
  issue: ["problem","challenge","concern","difficulty"],
  help: ["aid","assist","support","enable"],
  build: ["create","develop","construct","form"],
  create: ["build","produce","craft","form"],
  use: ["apply","employ"], // (no contractions)
  clear: ["evident","apparent","plain","obvious"],
  choose: ["select","pick","opt for","decide on"],
  complex: ["complicated","intricate","multi-layered"],
  simple: ["straightforward","basic","plain"],
  common: ["typical","usual","frequent","widespread"],
  rare: ["uncommon","infrequent","scarce"],
  begin: ["start","kick off"],
  end: ["finish","wrap up","conclude"],
  explain: ["clarify","break down","unpack"],
  reason: ["cause","basis","ground"],
  evidence: ["proof","support","documentation"],
  goal: ["aim","purpose","target","objective"],
  change: ["alter","modify","shift","adjust"],
  effective: ["workable","practical","efficient"],
  efficient: ["effective","productive"],
  analyze: ["examine","study","inspect","evaluate"],
  argue: ["contend","maintain","claim","assert"],
  because: ["since"],
  importanty: ["crucially"], // small typo-guard
};

/* Phrasal swaps and stock-pattern breakers */
const PHRASE_SWAPS = [
  [/in order to\b/gi, "to"],
  [/due to the fact that\b/gi, "because"],
  [/it is important to note that\b/gi, "note that"],
  [/it should be noted that\b/gi, "note that"],
  [/plays a significant role in\b/gi, "matters for"],
  [/in the context of\b/gi, "in"],
  [/with respect to\b/gi, "about"],
  [/as a result\b/gi, "so"],
  [/by means of\b/gi, "with"],
  [/in light of\b/gi, "considering"],
  [/a wide range of\b/gi, "many"],
];

/* Hedges to avoid over-certainty (detectors penalize absolutes) */
const HEDGES = {
  always: "often",
  never: "rarely",
  proves: "suggests",
  perfect: "great",
  flawless: "strong",
  undeniable: "clear",
  impossible: "very unlikely",
};

/* ============================ Text utilities ================================ */

const isSafeToken = (w) =>
  !/[0-9/@:_#/%]/.test(w) && !/^([A-Z][a-z]+)$/.test(w) && !STOP.has(w.toLowerCase());

const splitParagraphs = (t) => t.replace(/\r\n/g, "\n").split(/\n{2,}/);
const joinParagraphs = (p) => p.join("\n\n");

function splitSentences(p) {
  const parts = p
    .replace(/\s+/g, " ")
    .split(/([.!?]+)\s+/)
    .reduce((acc, cur, i, arr) => {
      if (i % 2 === 0) {
        const punct = arr[i + 1] ?? "";
        acc.push((cur + (punct || "")).trim());
      }
      return acc;
    }, [])
    .filter(Boolean);
  return parts.length ? parts : [p.trim()];
}
function joinSentences(ss) {
  return ss.join(" ");
}
function tidy(text) {
  let t = text;
  t = t.replace(/\s+([.,!?;:])/g, "$1");
  t = t.replace(/\s{2,}/g, " ");
  t = t.replace(/(^|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
  return t.trim();
}

/* ========================== Paraphrase building blocks ====================== */

// 1) Lexical: simplify formal words; swap phrases; synonyms
function simplifyWords(text) {
  let t = text;
  for (const [k, v] of Object.entries(SIMPLE)) {
    const re = new RegExp(`\\b${k}\\b`, "ig");
    t = t.replace(re, (m) => (m[0] === m[0].toUpperCase() ? title(v) : v));
  }
  return t;
}
function swapPhrases(text) {
  let t = text;
  for (const [re, rep] of PHRASE_SWAPS) t = t.replace(re, rep);
  return t;
}
function applySynonyms(text, creativity) {
  const prob = 0.72 + 0.25 * clamp01(creativity); // 72–97% chance per candidate
  return text.replace(/\b([A-Za-z][A-Za-z'-]{1,})\b/g, (match) => {
    const raw = match;
    const lower = raw.toLowerCase();
    if (!isSafeToken(raw)) return raw;
    const options = SYN[lower];
    if (!options || !options.length) return raw;
    if (!chance(prob)) return raw;
    const pick = options[rand(options.length)];
    if (raw === raw.toUpperCase()) return pick.toUpperCase();
    if (raw[0] === raw[0].toUpperCase()) return title(pick);
    return pick;
  });
}

// 2) Structure: passive→active; there-is; drop filler “that”; reorder clauses
function dropFillerThat(text, intensity = 1) {
  const re =
    /\b(say|says|said|believe|believes|believed|think|thinks|thought|feel|feels|felt|argue|argues|argued|note|notes|noted)\s+that\b/gi;
  return intensity > 0 ? text.replace(re, (m) => m.replace(/\s+that$/i, "")) : text;
}
function passiveToActive(text, intensity = 1) {
  if (intensity <= 0) return text;
  // crude yet safe: “was studied by Smith” → “Smith studied”
  return text.replace(
    /\b(was|were|is|are|been|being)\s+(\w+?ed)\s+by\s+([A-Z][\w-]*(?:\s+[A-Z][\w-]*)*)\b/g,
    (_, be, verbEd, agent) => {
      const root = verbEd.replace(/ed$/i, "");
      return `${agent} ${root}`;
    }
  );
}
function rewriteThereIs(text) {
  return text.replace(/\bThere\s+(?:is|are)\s+([a-z][^.!?]*)/gi, (m, grp) => {
    const g = grp.trim();
    return g ? title(g) : m;
  });
}
function reorderClauses(text, creativity) {
  if (creativity <= 0.35) return text;
  // “X, because Y.” -> “Because Y, X.”
  return text.replace(
    /(.+?),\s*(because|when|if|although)\s+([^,.!?]{3,})([.!?])/gi,
    (_, main, conj, clause, end) => {
      if (clause.split(/\s+/).length < 3) return _;
      const c = title(conj.toLowerCase());
      return `${c} ${clause}, ${main.trim()}${end}`;
    }
  );
}

// 3) Composition: split very long; merge very short; vary punctuation
function weaveLengths(sentences) {
  const out = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const n = s.split(/\s+/).length;

    // split long
    if (n > 28) {
      let cut = s.search(/,|\b(and|but|because|which|so|although|when|if)\b/i);
      if (cut < 0) cut = Math.floor(s.length / 2);
      out.push(s.slice(0, cut + 1).trim());
      out.push(s.slice(cut + 1).trim());
      continue;
    }
    // merge short
    if (n < 6 && out.length > 0) {
      out[out.length - 1] = tidy(out[out.length - 1] + " " + s);
    } else out.push(s);
  }
  return out;
}
function varyPunctuation(text, creativity) {
  // swap some commas to em dashes; remove a few extra commas
  let t = text;
  if (chance(0.25 + creativity * 0.4)) t = t.replace(/, (which|who)\b/gi, " — $1");
  if (chance(0.2 + creativity * 0.3)) t = t.replace(/, and\b/gi, " and");
  return t;
}
function softenAbsolutes(text, creativity) {
  let t = text;
  for (const [k, v] of Object.entries(HEDGES)) {
    const re = new RegExp(`\\b${k}\\b`, "ig");
    if (chance(0.7 * creativity + 0.2)) t = t.replace(re, v);
  }
  return t;
}
function stripStockOpeners(text) {
  let t = text;
  STOCK_OPENERS.forEach((p) => {
    const re = new RegExp(`^\\s*${p}\\s*,?\\s*`, "i");
    t = t.replace(re, "");
  });
  return t;
}

// 4) Noun-of → possessive (“the opinion of experts” → “experts’ opinion”)
function ofToPossessive(text) {
  return text.replace(
    /\bthe\s+([a-z]+)\s+of\s+([a-z][a-z-]*)\b/gi,
    (_, noun, owner) => `${owner}'s ${noun}`
  );
}

/* ============================ Rewriter pipeline ============================= */

function humanizeSentence(s, creativity) {
  let t = s;

  // intro cleanup first
  t = stripStockOpeners(t);

  // lexical reductions
  t = swapPhrases(t);
  t = simplifyWords(t);
  t = applySynonyms(t, creativity);

  // structure
  t = dropFillerThat(t, creativity);
  t = passiveToActive(t, creativity);
  if (creativity > 0.4) t = rewriteThereIs(t);
  t = reorderClauses(t, creativity);
  if (chance(0.35 + creativity * 0.3)) t = ofToPossessive(t);

  // rhythm/punctuation tweaks
  t = varyPunctuation(t, creativity);
  t = softenAbsolutes(t, creativity);

  return tidy(t);
}

function rewriteParagraph(p, creativity) {
  if (!p.trim()) return p;
  let ss = splitSentences(p);
  ss = weaveLengths(ss);
  ss = ss.map((s) => humanizeSentence(s, creativity));
  return tidy(joinSentences(ss));
}

function rewriteText(text, creativity) {
  let t = capToWords(text.trim(), 1000); // HARD CAP
  t = t.replace(/[\r\t]+/g, " ").replace(/\n[ \t]+/g, "\n");
  const paras = splitParagraphs(t).map((p) => rewriteParagraph(p, creativity));
  let out = joinParagraphs(paras);

  // Ensure paragraph separation for very long sentences
  out = out.replace(
    /(([^.!?]|\([^)]*\))+[.!?])\s+(?=[^\n])/g,
    (m) => (m.length > 220 ? m + "\n\n" : m + " ")
  );
  return tidy(out);
}

/* ============================= Detector heuristic =========================== */
/**
 * We estimate AI-likeness from several cues often correlated with detectors:
 *  - Low sentence length variance (rhythm too even)
 *  - Low content-word uniqueness (repetition of lemmas/stems)
 *  - Many stock discourse markers
 *  - Long average words with steady cadence (over-formal)
 *  - High comma density without punctuation variety
 */
function stemToken(t) {
  // super-simple stemmer to compare repetitions
  return lc(t).replace(/(ing|ed|ly|ment|tion|s)$/g, "");
}
function sentenceMetrics(s) {
  const tokens = s.match(WORD_RE) || [];
  const words = tokens.filter((w) => !STOP.has(lc(w)));
  const avgLen = tokens.length ? tokens.join("").length / tokens.length : 0;
  const commas = (s.match(/,/g) || []).length;
  const openers = STOCK_OPENERS.some((p) => new RegExp(`^\\s*${p}\\b`, "i").test(s));
  return {
    len: tokens.length,
    avgLen,
    commas,
    openers,
    unique: new Set(words.map(stemToken)).size,
    words: words.length,
  };
}
function computeAIScan(text) {
  const paras = splitParagraphs(text);
  const sentences = paras.flatMap(splitSentences).filter(Boolean);
  if (!sentences.length) return { ai: 0, human: 100, perSentence: [], threshold: 0 };

  const ms = sentences.map(sentenceMetrics);
  const lens = ms.map((m) => m.len);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
  const stdev = Math.sqrt(variance);
  const cov = mean ? stdev / mean : 0; // variety measure (higher is more human)

  const uniqueTotals = ms.map((m) => (m.words ? m.unique / m.words : 1));
  const uniqAvg = uniqueTotals.reduce((a, b) => a + b, 0) / uniqueTotals.length;

  const avgWordLen = ms.reduce((a, m) => a + m.avgLen, 0) / ms.length;
  const commaRate = ms.reduce((a, m) => a + m.commas, 0) / Math.max(1, ms.length);

  const openerCount = ms.filter((m) => m.openers).length;

  // score (higher → more AI-like)
  let score =
    45 * (0.28 - Math.min(0.28, cov)) + // low variety pushes score up
    25 * (0.58 - Math.min(0.58, uniqAvg)) + // low uniqueness pushes up
    10 * Math.min(1, openerCount / Math.max(1, sentences.length / 4)) +
    10 * Math.max(0, (avgWordLen - 5.6) / 2.2) +
    10 * Math.max(0, (commaRate - 0.8) / 2);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const ai = score;
  const human = 100 - ai;

  // per-sentence cue strength for highlighting
  const perSentence = sentences.map((s) => {
    const m = sentenceMetrics(s);
    const cues =
      (m.len < 9 ? 0 : m.len / 25) +
      (m.avgLen - 5.5) * 0.6 +
      (m.commas > 2 ? 0.8 : 0) +
      (m.openers ? 1.2 : 0);
    return { s, cues };
  });

  const sorted = [...perSentence].map((x) => x.cues).sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * 0.6)] || 0.75;

  return { ai, human, perSentence, threshold };
}

/* =================================== UI ==================================== */

export default function KaptainHumanizer() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [creativity, setCreativity] = useState(0.95);
  const [loading, setLoading] = useState(false);

  // analysis state (null → not computed yet)
  const [scanMode, setScanMode] = useState(false);
  const [scanHTML, setScanHTML] = useState("");
  const [aiPct, setAiPct] = useState(null);
  const [humanPct, setHumanPct] = useState(null);

  const handleInputChange = (e) => {
    const capped = capToWords(e.target.value, 1000);
    setInput(capped);
  };

  const handleHumanize = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setScanMode(false);
    setScanHTML("");
    setAiPct(null);
    setHumanPct(null);

    await new Promise((r) => setTimeout(r, 60)); // tiny UX pause

    const rewritten = rewriteText(input, creativity);
    setOutput(rewritten);
    setLoading(false);

    const scan = computeAIScan(rewritten);
    setAiPct(scan.ai);
    setHumanPct(scan.human);
  };

  const handleCheckAI = () => {
    const text = output || input;
    if (!text.trim()) return;
    const scan = computeAIScan(text);
    setAiPct(scan.ai);
    setHumanPct(scan.human);

    const paragraphs = splitParagraphs(text);
    let idx = 0;
    const html = paragraphs
      .map((p) => {
        const ss = splitSentences(p);
        const spans = ss.map((s) => {
          const cues = scan.perSentence[idx]?.cues ?? 0;
          const isAI = cues > scan.threshold;
          const bg = isAI ? "rgba(239,68,68,.18)" : "rgba(59,130,246,.18)";
          idx++;
          return `<span style="background:${bg};padding:2px 3px;border-radius:6px;box-shadow:0 0 0 1px rgba(0,0,0,.04) inset;">${escapeHTML(
            s
          )}</span>`;
        });
        return spans.join(" ");
      })
      .join("<br/><br/>");

    setScanHTML(html);
    setScanMode(true);
  };

  const handleCopy = async () => {
    const text = scanMode && scanHTML ? stripHTML(scanHTML) : output;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    alert("Copied!");
  };

  const handleReset = () => {
    setInput("");
    setOutput("");
    setScanMode(false);
    setScanHTML("");
    setAiPct(null);
    setHumanPct(null);
  };

  const inputWords = wordCount(input);
  const outputWords = wordCount(output);
  const atCap = inputWords >= 1000;

  return (
    <section className="card">
      <h2>Kaptain AI Humanizer</h2>

      {/* INPUT */}
      <textarea
        value={input}
        onChange={handleInputChange}
        placeholder="Paste your text here (max 1000 words)…"
        className="text-area"
      />
      <div style={{ marginTop: 4, fontSize: 12, color: atCap ? "#b91c1c" : "#6b7280" }}>
        Words: {inputWords} / 1000 {atCap ? " (max reached)" : ""}
      </div>

      {/* CONTROLS */}
      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}>
          <label>Creativity: {Math.round(creativity * 100)}%</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={creativity}
            onChange={(e) => setCreativity(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleHumanize} disabled={!input.trim() || loading}>
            {loading ? "Humanizing…" : "Humanize"}
          </button>
          <button onClick={handleCheckAI} disabled={!(output || input).trim()}>
            Check AI
          </button>
        </div>

        {/* ONLY show after actions */}
        {humanPct !== null && aiPct !== null && (
          <div
            className="chip"
            style={{ background: "transparent", border: "1px solid #d1d5db", color: "inherit" }}
          >
            Human {humanPct}% • AI {aiPct}%
          </div>
        )}
      </div>

      {/* OUTPUT */}
      <h3 style={{ marginTop: 16 }}>Output</h3>

      {!scanMode ? (
        <textarea
          readOnly
          value={output}
          placeholder="Your humanized text will appear here. Paragraphs are preserved."
          className="text-area"
        />
      ) : (
        <div
          className="text-area"
          style={{ whiteSpace: "pre-wrap", minHeight: 180, background: "#fff" }}
          dangerouslySetInnerHTML={{ __html: scanHTML || "" }}
        />
      )}
      <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
        Output words: {outputWords}
      </div>

      {/* ACTIONS */}
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={handleCopy} disabled={!(scanMode ? scanHTML : output)}>
          Copy
        </button>
        <button onClick={handleReset}>Reset</button>
      </div>
    </section>
  );
}
