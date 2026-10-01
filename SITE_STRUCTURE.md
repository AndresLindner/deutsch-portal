# German Learning Portal — Interactive Site Architecture & Blueprint

This document outlines the proposed organization and interactive architecture for transforming your German learning notes into a modern, highly engaging web application.

---

## 1. High-Level Concept & UX Vision

A clean, responsive, and learner-centric web application designed for fast reference, daily practice, and structured progression.

### Key Pillars
- **Categorized Progression**: Progressive paths from fundamentals (A1/A2) to intermediate concepts (B1/B2) or modular topical groupings.
- **Interactive Practice**: Flashcards, conjugation testers, fill-in-the-blank exercises, and word order builders.
- **Instant Search & Filter**: Real-time search across vocabulary, grammar rules, prepositions, and example sentences.
- **Visual Memory Aids**: Color-coded grammatical genders (🔵 **der** / 🔴 **die** / 🟢 **das** / 🟡 **die Plural**), case breakdown tables (Nominativ, Akkusativ, Dativ, Genitiv), and syntax order diagrams.

---

## 2. Information Architecture (Site Sections)

```
┌─────────────────────────────────────────────────────────────┐
│                   German Learning Portal                    │
├──────────────┬───────────────────────────────┬──────────────┤
│ 📚 Grammar   │ 🗣️ Vocabulary & Themes        │ ⚡ Practice   │
├──────────────┼───────────────────────────────┼──────────────┤
│ • Articles & │ • Core 500/1000 Words         │ • Flashcards │
│   Genders    │ • Thematic Sets (Work, Food,  │ • Sentence   │
│ • Cases (Nom,│   Travel, Daily Life, Tech)     Builder      │
│   Akk, Dat,  │ • Verbs with Prepositions     │ • Verb Drill │
│   Gen)       │ • Essential Idioms & Phrases  │ • Case Quiz  │
│ • Verb Tenses│ • False Friends & Common      │ • Spaced     │
│ • Preposition│   Traps                         Repetition   │
│   Rules      │                               │              │
│ • Word Order │                               │              │
│   (TeKaMoLo, │                               │              │
│   Nebensätze)│                               │              │
└──────────────┴───────────────────────────────┴──────────────┘
```

### Module 1: Grammar Reference & Visual Guides
1. **The Article System & Gender Mastery**
   - Rules, endings (`-ung`, `-heit`, `-keit`, `-chen`, `-ismus`), exceptions, and mnemonics.
   - Interactive gender guesser tool.
2. **The 4 Cases (Kasus)**
   - Definite, indefinite, negative, and possessive declensions.
   - Interactive matrix with live highlighter based on selected case.
3. **Prepositions (Präpositionen)**
   - **Akkusativ only** (bis, durch, für, gegen, ohne, um)
   - **Dativ only** (aus, bei, mit, nach, seit, von, zu, gegenüber)
   - **Two-Way / Wechselpräpositionen** (an, auf, hinter, in, neben, über, unter, vor, zwischen) with *Wohin? (Akk)* vs *Wo? (Dat)* visual comparison.
   - **Genitiv prepositions** (während, wegen, trotz, statt...).
4. **Verbs & Tenses (Zeitformen)**
   - Present (Präsens), Conversational Past (Perfekt + sein/haben), Written Past (Präteritum), Future (Futur I), Subjunctive II (Konjunktiv II - *hätte*, *wäre*, *würde*).
   - Modal verbs and separable prefix verbs (*trennbare Verben*).
5. **Sentence Structure & Syntax (Satzbau)**
   - Main clause rule: Verb at position 2 (V2).
   - Subordinate clause: Verb at the end (*weil*, *dass*, *obwohl*, *wenn*...).
   - Coordinating conjunctions (ADUSO: *aber, denn, und, sondern, oder*).
   - Time-Manner-Place guideline: **TeKaMoLo** (Temporal, Kausal, Modal, Lokal).

### Module 2: Vocabulary & Useful Expressions
- **Thematic Dictionaries**: Cards containing the German word, gender color tag, plural form, English translation, audio pronunciation button (Web Speech API), and contextual example sentence.
- **High-Frequency Colloquialisms & Redewendungen**: Everyday conversational phrases used by native speakers.
- **Verb-Preposition Combinations**: e.g., *warten auf (+ Akk)*, *sich interessieren für (+ Akk)*, *träumen von (+ Dat)* with quick test widgets.

### Module 3: Interactive Practice & Drills
- **Digital Flashcards**: Flip cards with Leitner spaced repetition logic (Known / Review).
- **Case & Preposition Trainer**: Fill-in-the-gap exercises with immediate feedback and explanation tooltips.
- **Verb Conjugator & Drill**: Type in the correct form for random pronouns and tenses.
- **Word Reordering**: Drag-and-drop or click-to-assemble sentences honoring German word order rules.

### Module 4: Personal Study Dashboard
- **Progress Tracking**: LocalStorage-saved completion marks for lessons and high scores in quizzes.
- **Bookmark / Favorites**: Save difficult words or grammar rules to a personal "Revision List".
- **Dark / Light Mode**: Eye-friendly reading modes.

---

## 3. Recommended Tech Stack for the Site

| Component | Choice | Rationale |
| :--- | :--- | :--- |
| **Framework** | **React / Vite** or **Next.js** (or standalone single-page bundle) | Lightning-fast page loads, interactive component state (cards, quizzes, filters), easy local hosting or web deployment. |
| **Styling** | **Tailwind CSS** | Modern aesthetic, flexible responsive layout, built-in dark mode support. |
| **Icons & Visuals** | **Lucide-React** | Crisp, lightweight icons for sound, checkmarks, navigation, and bookmarks. |
| **Audio** | **Native Web Speech Synthesis API** | Native German text-to-speech pronunciation without requiring external paid APIs. |
| **Data Storage** | **Structured JSON / Markdown** | Clean separation of your actual notes from the UI code, making future additions seamless. |

---

## 4. Next Step: Ingesting Your Google Doc

To tailor this site specifically to your exact notes and content:

1. **Option A (Quickest)**: In your Google Doc, click **Share** (top right) $\rightarrow$ under **General access**, change from **Restricted** to **"Anyone with the link can view"**.
2. **Option B**: Download the document (**File $\rightarrow$ Download $\rightarrow$ Plain Text (.txt)** or **Microsoft Word (.docx)**) and save it directly in this project directory (`New German Learning`).
3. **Option C**: Copy and paste the text directly into the chat.

Once accessible, we will extract all your specific rules, vocabulary, tables, and examples, map them directly into this structure, and build the interactive site!
