# 🇩🇪 Deutsch Portal • Interactive German Learning Web App

A modern, fast, responsive web application built from **Andres' German Lessons with Hanan** (*870+ vocabulary items, 50+ lesson dates, and complete Grammatik-Cheatsheet*).

---

## 🚀 Quick Start

To launch and use the app immediately:

1. **Option A (Instant macOS launch)**:
   - Double-click [`index.html`](file:///Users/andreslindner/Desktop/New%20German%20Learning/index.html) in Finder, **OR**
   - Run in terminal:
     ```bash
     open index.html
     ```

2. **Option B (Local Web Server)**:
   - Run:
     ```bash
     python3 -m http.server 8080
     ```
   - Open `http://localhost:8080` in Chrome, Safari, or Firefox.

*Zero compilation or dependencies needed — loads in < 50ms, works offline, and stores your progress automatically in LocalStorage.*

---

## 🌟 What's Included

### 1. 🗣️ Vokabular Explorer (870+ Words)
- **Multi-Dimensional Filters**:
  - Filter by **Lesson Date** (dropdown with all 50 sessions from 29.09. backwards).
  - Filter by **Topic**: *Food & Dining, Work & Tech, Travel & Switzerland, Family & People, Home & Daily Life, Feelings & Health, Everyday Expressions*.
  - Filter by **Grammatical Gender**: All, 🔵 *der*, 🔴 *die*, 🟢 *das*, 🟡 *die (plural)*.
  - Filter by **Starred Words** (your personal study list).
- **Audio Pronunciation**: Click the 🔊 button on any word or sentence to hear native German pronunciation (`de-DE`) with adjustable playback speed (0.8x, 1.0x, 1.2x).
- **Authentic Lesson Examples**: Context sentences from your sessions with Bea, Shelby, Google office life, travel to Davos, Neuchatel, and Südtirol.

### 2. 📚 Grammatik Studio (Interactive Visualizer)
- **Articles & The 4 Cases (Kasus)**:
  - Interactive table: Click any case (*Nominativ, Akkusativ, Dativ, Genitiv*) or gender to dynamically highlight the exact cell and see what changes.
  - Personal pronoun transformation matrix (*ich $\rightarrow$ mich $\rightarrow$ mir $\rightarrow$ meiner*).
- **Preposition Matrix (Präpositionen)**:
  - Akkusativ Only (DOGFU: *durch, für, gegen, ohne, um, bis*).
  - Dativ Only (*aus, bei, mit, nach, seit, von, zu, gegenüber, ab, außer*).
  - **Two-Way Prepositions (Wechselpräpositionen)**: Interactive **"Wohin? (Movement $\rightarrow$ Akk)"** vs **"Wo? (Stationary $\rightarrow$ Dat)"** toggle.
  - Genitiv prepositions & *Da-* / *Wo-* compounds (*womit $\rightarrow$ damit*, *worauf $\rightarrow$ darauf*).
- **Modalverben**:
  - Full conjugations in Präsens & Präteritum (*können, dürfen, müssen, wollen, sollen, mögen, möchten*).
  - Nuance guide (*wollen* = desire, NOT future will; *müssen* vs *nicht müssen*).
- **Vowel Shifts (Vokalwechsel in 2./3. Person)**:
  - $a \rightarrow \ddot{a}$, $e \rightarrow ie$, $e \rightarrow i$, $au \rightarrow \ddot{a}u$ with interactive verb cards.
- **Prefixes (Trennbare & Untrennbare Verben)**:
  - Inseparable prefixes (*be-, emp-, ent-, er-, ge-, miss-, ver-, zer-, hinter-*).
  - Dual-meaning prefixes (e.g. *umfahren*: run over vs avoid!).
- **Word Order (Satzbau & V2 Rule)**:
  - Interactive sentence slider: Start with Time, Subject, or Object and see the conjugated verb remain locked at Position 2.
  - Nebensätze (*weil, dass, als, obwohl*) rule visualizer.
  - TeKaMoLo order guide.
- **Past Tense (Das Perfekt)**:
  - *Sein* vs. *Haben* decision rules (movement, change of condition, special verbs).
  - 4 Partizip II formation groups.
- **Colloquial Time & Numbers**:
  - Formal vs informal time expressions (*halb sieben*, *fünf vor halb*).
  - Numbers spelling guide (0 to 1 Trillion) and directions (*oben $\rightarrow$ rauf*).

### 3. ⚡ Practice & Quiz Arena
- **Digital Flashcards**:
  - 3D card flip animation (click card or press <kbd>Space</kbd>).
  - Left / Right arrow navigation.
  - Shuffle deck and "Starred Only" practice modes.
  - Track mastered vs review cards.
- **Modal Verb Fill-in-the-Blank Drill**:
  - 34 authentic sentences from your notes.
  - Instant validation with grammatical explanations and score/streak tracking.
- **Der / Die / Das Rapid-Fire Guesser**:
  - Test your article memory against all nouns in your vocabulary bank.

### 4. 📝 Journal & Homework Studio
- **Davos & Südtirol Trip Journals**:
  - Side-by-side view comparing original student drafts to Hanan's corrected German.
  - Interactive annotations explaining why corrections were made (e.g. *für zwei Tage gefahren*, *in der Nähe des Hotels*, *auf dem Spielplatz*).
- **Personal German Scratchpad**:
  - Writing area with live word & character counter.
  - Quick-insert buttons for German umlauts (`ä`, `ö`, `ü`, `ß`, `Ä`, `Ö`, `Ü`).
  - Read aloud with native German speech synthesis.

---

## 📁 Project Structure

```
New German Learning/
├── index.html                   # Main application entry point
├── app.js                       # Core application logic & state controller
├── styles.css                   # Custom styles, 3D card flip, and theme accents
├── data/
│   ├── vocab.js                 # 870+ categorized vocabulary items
│   ├── grammar.js               # Structured cheatsheet & grammar models
│   ├── quizzes.js               # 38+ interactive modal & translation exercises
│   └── journals.js              # Davos & Südtirol stories with tutor annotations
├── scripts/
│   └── build_app_data.py        # Automated parser that transforms raw notes to JS data
├── extracted_doc.txt            # Raw text extracted from Google Doc
├── CONTENT_ORGANIZATION_PLAN.md # Comprehensive content architecture blueprint
├── SITE_STRUCTURE.md            # Initial site structure proposal
└── README.md                    # Project documentation
```

---

## ⌨️ Keyboard Shortcuts
- <kbd>Space</kbd> : Flip flashcard
- <kbd>→</kbd> : Next flashcard
- <kbd>←</kbd> : Previous flashcard
- <kbd>Enter</kbd> : Submit answer in Quiz Arena
