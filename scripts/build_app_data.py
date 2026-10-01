#!/usr/bin/env python3
import re
import json

def build_data():
    with open('extracted_doc.txt', 'r', encoding='utf-8') as f:
        text = f.read()

    split_idx = text.find('Grammatik-Cheatsheet Hanan')
    vocab_raw = text[:split_idx]
    cheatsheet_raw = text[split_idx:]

    # 1. PARSE VOCABULARY
    lines = vocab_raw.split('\n')
    current_date = "Intro / Basics"
    vocab_list = []
    
    # We will track current item to attach sub-bullets or examples
    current_item = None
    item_id = 1

    def categorize(de, en):
        txt = (de + " " + en).lower()
        if any(w in txt for w in ['essen', 'trinken', 'bier', 'kaffee', 'kuchen', 'fleisch', 'wurst', 'küche', 'kochen', 'messer', 'schokolade', 'käse', 'apfel', 'teller', 'restaurant', 'frühstück', 'mittag', 'abendessen', 'tee', 'milch', 'suppe', 'backen', 'lecker', 'lebensmittel', 'schmeckt', 'kleckern', 'kneten']):
            return 'Food & Dining'
        if any(w in txt for w in ['arbeit', 'büro', 'google', 'chef', 'kolleg', 'job', 'gehalt', 'kündigung', 'projekt', 'meeting', 'karriere', 'überstunden', 'firma', 'kunde', 'vertrag', 'erfolg', 'verdienen', 'geschäft', 'computer']):
            return 'Work & Tech'
        if any(w in txt for w in ['reise', 'zug', 'flug', 'urlaub', 'schweiz', 'zürich', 'davos', 'hotel', 'berge', 'see', 'strand', 'fluss', 'bahnhof', 'auto', 'fahren', 'wandern', 'ausland', 'stadt', 'flughafen', 'stau', 'segeln', 'rigi', 'neuchatel', 'südtirol', 'sommer', 'winter', 'wasserfall']):
            return 'Travel & Switzerland'
        if any(w in txt for w in ['mutter', 'vater', 'sohn', 'tochter', 'frau', 'mann', 'kind', 'schwiegermutter', 'familie', 'freund', 'eltern', 'baby', 'hochzeit', 'heiraten', 'bea', 'shelby', 'oma', 'opa', 'schwester', 'bruder', 'schwieger']):
            return 'Family & People'
        if any(w in txt for w in ['wohnung', 'haus', 'zimmer', 'bett', 'schlafen', 'tür', 'fenster', 'möbel', 'schlüssel', 'bad', 'spielplatz', 'sofa', 'tisch', 'stuhl', 'schrank', 'balkon', 'garten', 'putzen', 'aufräumen', 'miete', 'waschen']):
            return 'Home & Daily Life'
        if any(w in txt for w in ['heiß', 'kalt', 'müde', 'freuen', 'angst', 'glücklich', 'traurig', 'schmerz', 'sorge', 'krank', 'fieber', 'gesund', 'arzt', 'wütend', 'lust', 'bock', 'peinlich', 'aufgeregt', 'nervig', 'wohl', 'übel', 'spüren', 'fühlen']):
            return 'Feelings & Health'
        if any(w in txt for w in ['verb', 'präposition', 'konjug', 'modal', 'satz', 'regel', 'perfekt', 'präteritum', 'weil', 'dass', 'obwohl', 'wenn', 'als', 'grammatik', 'akkusativ', 'dativ', 'nominativ', 'genitiv']):
            return 'Grammar & Rules'
        return 'Everyday Expressions'

    def parse_gender_and_article(de):
        de_str = de.strip()
        # Plural check first
        if de_str.lower().startswith('die ') and ('(pl' in de_str.lower() or 'pl.)' in de_str.lower() or 'leute' in de_str.lower() or 'eltern' in de_str.lower() or 'lebensmittel' in de_str.lower()):
            return ('die (pl)', 'plural', de_str[4:].strip())
        if de_str.startswith('der '):
            return ('der', 'masculine', de_str[4:].strip())
        if de_str.startswith('die '):
            return ('die', 'feminine', de_str[4:].strip())
        if de_str.startswith('das '):
            return ('das', 'neuter', de_str[4:].strip())
        return (None, None, de_str)

    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        line_strip = line.strip()

        if not line_strip:
            i += 1
            continue

        # Check for date header
        date_match = re.match(r'^(\d{1,2}\.\d{1,2}\.?(?:\d{2,4})?)$', line_strip)
        if date_match:
            current_date = date_match.group(1)
            i += 1
            continue

        # Check for separator or header
        if line_strip.startswith('===') or line_strip.startswith('---') or line_strip.lower() == 'vokabular hanan' or line_strip.lower() == 'sheet of words to memorize':
            i += 1
            continue

        # Check for word with '=' definition
        if '=' in line_strip and not line_strip.startswith('→') and not line_strip.startswith('//'):
            parts = line_strip.split('=', 1)
            german_raw = parts[0].strip()
            english_raw = parts[1].strip()

            article, gender, base_word = parse_gender_and_article(german_raw)

            # Plural detection if embedded like "der Flug, die Flüge"
            plural = None
            if ',' in base_word and any(p in base_word for p in ['die ', 'pl.']):
                subparts = base_word.split(',', 1)
                base_word = subparts[0].strip()
                plural = subparts[1].strip()

            item = {
                "id": item_id,
                "german": german_raw,
                "base_word": base_word,
                "english": english_raw,
                "article": article,
                "gender": gender,
                "plural": plural,
                "date": current_date,
                "category": categorize(german_raw, english_raw),
                "examples": [],
                "notes": []
            }
            vocab_list.append(item)
            current_item = item
            item_id += 1
            i += 1
            continue

        # If line starts with arrow or is an example sentence / subnote
        if current_item is not None:
            if line_strip.startswith('→') or line_strip.startswith('- ') or line_strip.startswith('* '):
                content = re.sub(r'^[→\-\*]\s*', '', line_strip)
                if '=' in content:
                    ex_parts = content.split('=', 1)
                    current_item["examples"].append({
                        "de": ex_parts[0].strip(),
                        "en": ex_parts[1].strip()
                    })
                elif any(c in content for c in ['du ', 'habe ', 'ist ', 'hat ', 'wird ']):
                    current_item["notes"].append(content)
                else:
                    current_item["examples"].append({
                        "de": content,
                        "en": ""
                    })
            elif line_strip.startswith('//'):
                current_item["notes"].append(line_strip.lstrip('/ ').strip())
            elif len(line_strip) > 10 and not line_strip.startswith('Hausaufgabe') and not line_strip.startswith('To do:'):
                # Context sentence
                current_item["examples"].append({
                    "de": line_strip,
                    "en": ""
                })
        i += 1

    print(f"Extracted {len(vocab_list)} rich vocabulary entries!")

    # 2. PARSE GRAMMAR DATA
    grammar_data = {
        "articles_cases": {
            "cases": [
                {
                    "case": "Nominativ",
                    "role": "Subject",
                    "question": "Wer oder was? (Who or what?)",
                    "description": "The person or entity performing the action. Governs the verb conjugation.",
                    "color": "blue",
                    "definite": {"m": "der", "f": "die", "n": "das", "pl": "die"},
                    "indefinite": {"m": "ein", "f": "eine", "n": "ein", "pl": "-"},
                    "negative": {"m": "kein", "f": "keine", "n": "kein", "pl": "keine"},
                    "pronouns": [
                        {"de": "ich", "en": "I"},
                        {"de": "du", "en": "you (sg.)"},
                        {"de": "er", "en": "he"},
                        {"de": "sie", "en": "she"},
                        {"de": "es", "en": "it"},
                        {"de": "man", "en": "one / people"},
                        {"de": "wir", "en": "we"},
                        {"de": "ihr", "en": "you guys"},
                        {"de": "sie / Sie", "en": "they / You (formal)"}
                    ]
                },
                {
                    "case": "Akkusativ",
                    "role": "Direct Object",
                    "question": "Wen oder was? (Whom or what?)",
                    "description": "The entity directly affected or acted upon. Only masculine changes (der -> den, ein -> einen).",
                    "color": "emerald",
                    "definite": {"m": "den", "f": "die", "n": "das", "pl": "die"},
                    "indefinite": {"m": "einen", "f": "eine", "n": "ein", "pl": "-"},
                    "negative": {"m": "keinen", "f": "keine", "n": "kein", "pl": "keine"},
                    "pronouns": [
                        {"de": "mich", "en": "me (e.g. you know me)"},
                        {"de": "dich", "en": "you"},
                        {"de": "ihn", "en": "him"},
                        {"de": "sie", "en": "her"},
                        {"de": "es", "en": "it"},
                        {"de": "einen", "en": "one"},
                        {"de": "uns", "en": "us"},
                        {"de": "euch", "en": "you guys"},
                        {"de": "sie / Sie", "en": "them / You (formal)"}
                    ]
                },
                {
                    "case": "Dativ",
                    "role": "Indirect Object / Recipient",
                    "question": "Wem? (To whom / For whom?)",
                    "description": "The recipient of the action or direct object. E.g., 'I give YOU a present' = 'Ich gebe DIR ein Geschenk'.",
                    "color": "amber",
                    "definite": {"m": "dem", "f": "der", "n": "dem", "pl": "den (+n)"},
                    "indefinite": {"m": "einem", "f": "einer", "n": "einem", "pl": "N/A"},
                    "negative": {"m": "keinem", "f": "keiner", "n": "keinem", "pl": "keinen (+n)"},
                    "pronouns": [
                        {"de": "mir", "en": "to me"},
                        {"de": "dir", "en": "to you"},
                        {"de": "ihm", "en": "to him"},
                        {"de": "ihr", "en": "to her"},
                        {"de": "ihm", "en": "to it"},
                        {"de": "einem", "en": "to one"},
                        {"de": "uns", "en": "to us"},
                        {"de": "euch", "en": "to you guys"},
                        {"de": "ihnen / Ihnen", "en": "to them / to You (formal)"}
                    ]
                },
                {
                    "case": "Genitiv",
                    "role": "Possession & Formal Prepositions",
                    "question": "Wessen? (Whose?)",
                    "description": "Indicates ownership or follows prepositions like während, wegen, trotz, statt.",
                    "color": "purple",
                    "definite": {"m": "des (+s/es)", "f": "der", "n": "des (+s/es)", "pl": "der"},
                    "indefinite": {"m": "eines (+s/es)", "f": "einer", "n": "eines (+s/es)", "pl": "-"},
                    "negative": {"m": "keines (+s/es)", "f": "keiner", "n": "keines (+s/es)", "pl": "keiner"},
                    "pronouns": [
                        {"de": "meiner", "en": "of me"},
                        {"de": "deiner", "en": "of you"},
                        {"de": "seiner", "en": "of him"},
                        {"de": "ihrer", "en": "of her"},
                        {"de": "seiner", "en": "of it"},
                        {"de": "eines", "en": "of one"},
                        {"de": "unserer", "en": "of us"},
                        {"de": "eurer", "en": "of you guys"},
                        {"de": "ihrer / Ihrer", "en": "of them / of You"}
                    ]
                }
            ]
        },
        "modal_verbs": {
            "title": "Modalverben (Modal Verbs)",
            "rule": "Zeigen Haltung zum Verb (Attitude towards the action). Conjugated modal verb takes Position 2; the main infinitive verb is locked at the absolute end of the clause.",
            "verbs": [
                {
                    "verb": "können",
                    "meaning": "Ability / Possibility (can, be able to)",
                    "praesens": {"ich": "kann", "du": "kannst", "er_sie_es": "kann", "wir": "können", "ihr": "könnt", "sie_Sie": "können"},
                    "praeteritum": {"ich": "konnte", "du": "konntest", "er_sie_es": "konnte", "wir": "konnten", "ihr": "konntet", "sie_Sie": "konnten"},
                    "examples": [
                        "Ich kann dir leider nicht helfen. (Unfortunately I cannot help you.)",
                        "Sie kann sehr gut Deutsch sprechen. (She can speak German very well.)"
                    ]
                },
                {
                    "verb": "dürfen",
                    "meaning": "Permission (may, be allowed to) / Prohibition with 'nicht'",
                    "praesens": {"ich": "darf", "du": "darfst", "er_sie_es": "darf", "wir": "dürfen", "ihr": "dürft", "sie_Sie": "dürfen"},
                    "praeteritum": {"ich": "durfte", "du": "durftest", "er_sie_es": "durfte", "wir": "durften", "ihr": "durftet", "sie_Sie": "durften"},
                    "examples": [
                        "Man darf hier nicht rauchen. (Smoking is not permitted here.)",
                        "Darf ich das Fenster aufmachen? (May I open the window?)"
                    ]
                },
                {
                    "verb": "müssen",
                    "meaning": "Obligation / Inevitability (must, have to) — 'nicht müssen' = don't have to (NOT forbidden!)",
                    "praesens": {"ich": "muss", "du": "musst", "er_sie_es": "muss", "wir": "müssen", "ihr": "müsst", "sie_Sie": "müssen"},
                    "praeteritum": {"ich": "musste", "du": "musstest", "er_sie_es": "musste", "wir": "mussten", "ihr": "musstet", "sie_Sie": "mussten"},
                    "examples": [
                        "Ich muss morgen früh arbeiten. (I have to work early tomorrow.)",
                        "Du musst nicht frühstücken, wenn du keinen Hunger hast. (You don't have to eat breakfast...)"
                    ]
                },
                {
                    "verb": "wollen",
                    "meaning": "Desire / Strong Will (want to — NOT future 'will'!)",
                    "praesens": {"ich": "will", "du": "willst", "er_sie_es": "will", "wir": "wollen", "ihr": "wollt", "sie_Sie": "wollen"},
                    "praeteritum": {"ich": "wollte", "du": "wolltest", "er_sie_es": "wollte", "wir": "wollten", "ihr": "wolltet", "sie_Sie": "wollten"},
                    "examples": [
                        "Ich will die Weltmeisterschaft schauen. (I want to watch the World Cup.)",
                        "Wollt ihr morgen in den Zoo gehen? (Do you guys want to go to the zoo tomorrow?)"
                    ]
                },
                {
                    "verb": "sollen",
                    "meaning": "Duty / Recommendation / Instruction (supposed to, should)",
                    "praesens": {"ich": "soll", "du": "sollst", "er_sie_es": "soll", "wir": "sollen", "ihr": "sollt", "sie_Sie": "sollen"},
                    "praeteritum": {"ich": "sollte", "du": "solltest", "er_sie_es": "sollte", "wir": "sollten", "ihr": "solltet", "sie_Sie": "sollten"},
                    "examples": [
                        "Man soll freundlich sein. (One should be friendly.)",
                        "Thomas soll die Bestellung heraussuchen. (Thomas is supposed to find the order.)"
                    ]
                },
                {
                    "verb": "mögen / möchten",
                    "meaning": "mögen = to like (standalone verb) | möchten = would like to (polite modal wish)",
                    "praesens": {"ich": "mag / möchte", "du": "magst / möchtest", "er_sie_es": "mag / möchte", "wir": "mögen / möchten", "ihr": "mögt / möchtet", "sie_Sie": "mögen / möchten"},
                    "praeteritum": {"ich": "mochte", "du": "mochtest", "er_sie_es": "mochte", "wir": "mochten", "ihr": "mochtet", "sie_Sie": "mochten"},
                    "examples": [
                        "Ich mag Kaffee. (I like coffee — standalone noun)",
                        "Ich möchte einen Cappuccino, bitte. (I would like a cappuccino, please.)",
                        "Ich möchte am Wochenende schwimmen gehen. (I would like to go swimming this weekend.)"
                    ]
                }
            ]
        },
        "prepositions": {
            "akkusativ": {
                "title": "Akkusativ Only",
                "mnemonic": "DOGFU / FUDGE-B (durch, ohne, gegen, für, um, bis)",
                "items": [
                    {"prep": "durch", "en": "through", "ex": "Wir gehen durch den Park."},
                    {"prep": "für", "en": "for", "ex": "Das Geschenk ist für meinen Sohn."},
                    {"prep": "gegen", "en": "against / around (time)", "ex": "Ich komme gegen 20:00 Uhr."},
                    {"prep": "ohne", "en": "without", "ex": "Ohne dich kann ich nicht gehen."},
                    {"prep": "um", "en": "around / at (time)", "ex": "Wir sitzen um den Tisch. / Um wie viel Uhr?"},
                    {"prep": "bis", "en": "until / up to", "ex": "Bis nächsten Freitag!"}
                ]
            },
            "dativ": {
                "title": "Dativ Only",
                "mnemonic": "aus - bei - mit - nach - seit - von - zu - gegenüber - ab - außer",
                "items": [
                    {"prep": "aus", "en": "out of / from (origin)", "ex": "Ich komme aus der Schweiz."},
                    {"prep": "bei", "en": "at / with / at the place of", "ex": "Wir haben bei meiner Mutter übernachtet."},
                    {"prep": "mit", "en": "with / by (transport)", "ex": "Ich fahre mit dem Zug."},
                    {"prep": "nach", "en": "to (cities/countries) / after", "ex": "Wir sind nach Davos gegangen. / Nach dem Meeting."},
                    {"prep": "seit", "en": "since / for (time duration)", "ex": "Ich wohne seit zwei Jahren in Zürich."},
                    {"prep": "von", "en": "from / of", "ex": "Ein Freund von meiner Mutter."},
                    {"prep": "zu", "en": "to (people/places within town)", "ex": "Sie ist zu Besuch gekommen. / Geh zum Arzt."},
                    {"prep": "gegenüber", "en": "opposite / across from", "ex": "Gegenüber dem Bahnhof."},
                    {"prep": "ab", "en": "from (time/place onward)", "ex": "Ab nächster Woche."},
                    {"prep": "außer", "en": "except for", "ex": "Alle außer mir."}
                ]
            },
            "wechsel": {
                "title": "Two-Way Prepositions (Wechselpräpositionen)",
                "rule": "Wohin? (Movement / Destination) -> AKKUSATIV | Wo? (Stationary Location) -> DATIV",
                "items": [
                    {"prep": "an", "en": "at / on (vertical border)", "akk": "Ich gehe an den See.", "dat": "Ich sitze am See (an dem See)."},
                    {"prep": "auf", "en": "on top of (horizontal)", "akk": "Ich lege das Buch auf den Tisch.", "dat": "Das Buch liegt auf dem Tisch."},
                    {"prep": "hinter", "en": "behind", "akk": "Geh hinter das Haus!", "dat": "Das Auto steht hinter dem Haus."},
                    {"prep": "in", "en": "in / into", "akk": "Wir gehen ins Kino (in das Kino).", "dat": "Wir sind im Kino (in dem Kino)."},
                    {"prep": "neben", "en": "next to", "akk": "Stell den Stuhl neben den Tisch.", "dat": "Der Stuhl steht neben dem Tisch."},
                    {"prep": "über", "en": "over / above", "akk": "Die Brücke über den Fluss.", "dat": "Die Lampe hängt über dem Tisch."},
                    {"prep": "unter", "en": "under / below", "akk": "Die Katze kriecht unter das Bett.", "dat": "Die Katze schläft unter dem Bett."},
                    {"prep": "vor", "en": "in front of / ago (Dat)", "akk": "Fahr das Auto vor die Tür.", "dat": "Das Auto steht vor der Tür. / Vor langer Zeit (ago)."},
                    {"prep": "zwischen", "en": "between", "akk": "Setz dich zwischen die Kinder.", "dat": "Er sitzt zwischen den Kindern."}
                ]
            },
            "genitiv": {
                "title": "Genitiv Prepositions",
                "items": [
                    {"prep": "während", "en": "during", "ex": "Während des Urlaubs."},
                    {"prep": "wegen", "en": "because of", "ex": "Wegen des schlechten Wetters."},
                    {"prep": "trotz", "en": "despite", "ex": "Trotz des Regens sind wir gewandert."},
                    {"prep": "statt / anstatt", "en": "instead of", "ex": "Statt eines Kaffees trinke ich Tee."}
                ]
            },
            "pronominal_adverbs": {
                "title": "Da- & Wo- Compounds",
                "rule": "Question with thing: Wo + (r) + Prep | Answer with thing: Da + (r) + Prep",
                "examples": [
                    {"question": "Womit? (With what?)", "answer": "Damit (With that / it)"},
                    {"question": "Worauf? (On what?)", "answer": "Darauf (On that / it)"},
                    {"question": "Woran? (At what?)", "answer": "Daran (At that / it)"},
                    {"question": "Wovon? (About what?)", "answer": "Davon (About that / it)"}
                ]
            }
        },
        "vowel_shifts": {
            "title": "Vokalwechsel (Vowel Shifts in 2. & 3. Person Singular)",
            "shifts": [
                {
                    "change": "a -> ä",
                    "sound": "[eh] sound",
                    "verbs": ["backen (du bäckst)", "empfangen (du empfängst)", "fahren (du fährst)", "fallen (du fällst)", "halten (du hältst)", "laden (du lädst)", "lassen (du lässt)", "schlafen (du schläfst)", "schlagen (du schlägst)", "tragen (du trägst)", "waschen (du wäschst)"]
                },
                {
                    "change": "e -> ie",
                    "sound": "long [ee] sound",
                    "verbs": ["empfehlen (du empfiehlst)", "lesen (du liest)", "sehen (du siehst)", "stehlen (du stiehlst)", "befehlen (du befiehlst)"]
                },
                {
                    "change": "e -> i",
                    "sound": "short [ih] sound",
                    "verbs": ["brechen (du brichst)", "essen (du isst)", "geben (du gibst)", "gelten (es gilt)", "helfen (du hilfst)", "nehmen (du nimmst)", "stechen (du stichst)", "sprechen (du sprichst)", "sterben (du stirbst)", "treffen (du triffst)", "treten (du trittst)", "vergessen (du vergisst)", "werfen (du wirfst)"]
                },
                {
                    "change": "au -> äu",
                    "sound": "[oi] sound",
                    "verbs": ["laufen (du läufst)", "saufen (du säufst)"]
                }
            ]
        },
        "separable_verbs": {
            "title": "Trennbare & Untrennbare Verben",
            "rule": "Stressed prefix = Separable (prefix moves to sentence end). Unstressed prefix = Inseparable (no ge- in Partizip II).",
            "inseparable_prefixes": [
                {"prefix": "be-", "ex": "Ich beende das Projekt."},
                {"prefix": "emp-", "ex": "Ich empfehle das Restaurant."},
                {"prefix": "ent-", "ex": "Ich entkomme der Gefahr."},
                {"prefix": "er-", "ex": "Ich erfahre die Neuigkeit."},
                {"prefix": "ge-", "ex": "Das gehört mir."},
                {"prefix": "miss-", "ex": "Ich missverstehe dich nicht."},
                {"prefix": "ver-", "ex": "Ich verbringe Zeit mit Freunden."},
                {"prefix": "zer-", "ex": "Ich zerstöre nichts."},
                {"prefix": "hinter-", "ex": "Ich hinterfrage das System."}
            ],
            "variable_prefixes": [
                {"prefix": "um-", "sep": "fahre ... um (run over)", "insep": "umfahre (bypass/avoid driving into)"},
                {"prefix": "über-", "sep": "laufe ... über (spill over)", "insep": "überwinde (overcome)"},
                {"prefix": "unter-", "sep": "gehe ... unter (drown/sink)", "insep": "untergrabe (undermine)"},
                {"prefix": "durch-", "sep": "falle ... durch (fail/fall through)", "insep": "durchdenke (think through)"},
                {"prefix": "wider-", "sep": "spiegle ... wider (reflect)", "insep": "widerspreche (contradict/talk back)"}
            ]
        },
        "word_order": {
            "title": "Satzbau & Verbzweitstellung (V2 Rule)",
            "main_clause": "In main clauses (Hauptsätze), the CONJUGATED VERB is strictly at Position 2. Position 1 can be Subject, Time, or Object.",
            "examples": [
                {"pos1": "Ich", "verb": "hatte", "pos3": "letzten Mai die Grippe."},
                {"pos1": "Letzten Mai", "verb": "hatte", "pos3": "ich die Grippe."},
                {"pos1": "Die Grippe", "verb": "hatte", "pos3": "ich letzten Mai."}
            ],
            "tekamolo": "TeKaMoLo Order for Middle Field: Temporal (When?) -> Kausal (Why?) -> Modal (How?) -> Lokal (Where?)",
            "subordinate": "In subordinate clauses (Nebensätze with weil, dass, als, obwohl, wenn), the conjugated verb is pushed to the VERY END."
        },
        "perfekt": {
            "title": "Das Perfekt (Spoken Past)",
            "formula": "Hilfsverb (haben / sein im Präsens, Position 2) + Partizip II (am Satzende)",
            "sein_rule": "Use SEIN for: Movement/direction change (gehen, fahren, fliegen, schwimmen), Change of condition (aufwachen, einschlafen, sterben, wachsen), and special verbs (bleiben, sein, werden, passieren, gelingen). Use HABEN for all other verbs.",
            "participle_types": [
                {"type": "Weak (Regular)", "rule": "ge- + Stamm + -t", "ex": "kaufen -> gekauft, arbeiten -> gearbeitet"},
                {"type": "Strong (Irregular)", "rule": "ge- + Stamm (Vokalwechsel) + -en", "ex": "gehen -> gegangen, trinken -> getrunken"},
                {"type": "Mixed", "rule": "ge- + Stamm (Vokalwechsel) + -t", "ex": "bringen -> gebracht, brennen -> gebrannt"},
                {"type": "-ieren Verbs", "rule": "No 'ge-', ends in '-t'", "ex": "fotografieren -> fotografiert, präsentieren -> präsentiert"}
            ]
        },
        "directions": {
            "title": "Ort vs. Richtung (Location vs. Direction)",
            "items": [
                {"formal_prep": "auf (on)", "ort": "oben (upstairs/above)", "richtung": "rauf / hinauf (upwards)"},
                {"formal_prep": "unter (under)", "ort": "unten (downstairs/below)", "richtung": "runter / hinunter (downwards)"},
                {"formal_prep": "in (in)", "ort": "drinnen (inside)", "richtung": "rein / hinein (to inside)"},
                {"formal_prep": "aus (out)", "ort": "draußen (outside)", "richtung": "raus / hinaus (to outside)"},
                {"formal_prep": "über (over)", "ort": "drüben (over there)", "richtung": "rüber / hinüber (to the other side)"}
            ]
        },
        "time_and_numbers": {
            "time": {
                "formal_vs_informal": [
                    {"clock": "07:00 / 19:00", "informal": "Es ist sieben (Uhr)", "formal": "sieben Uhr / neunzehn Uhr"},
                    {"clock": "07:15 / 19:15", "informal": "Viertel nach sieben", "formal": "sieben Uhr fünfzehn"},
                    {"clock": "06:30 / 18:30", "informal": "halb sieben", "formal": "sechs Uhr dreißig"},
                    {"clock": "06:25 / 18:25", "informal": "fünf vor halb sieben", "formal": "sechs Uhr fünfundzwanzig"},
                    {"clock": "06:35 / 18:35", "informal": "fünf nach halb sieben", "formal": "sechs Uhr fünfunddreißig"},
                    {"clock": "06:45 / 18:45", "informal": "Viertel vor sieben", "formal": "sechs Uhr fünfundvierzig"}
                ]
            },
            "numbers": [
                {"n": "0-12", "text": "null, eins, zwei, drei, vier, fünf, sechs, sieben, acht, neun, zehn, elf, zwölf"},
                {"n": "13-19", "text": "dreizehn, vierzehn, fünfzehn, sechzehn (not sechszehn!), siebzehn (not siebenzehn!), achtzehn, neunzehn"},
                {"n": "20-99", "text": "zwanzig, einundzwanzig (unit + und + tens), dreißig (with ß), vierzig, fünfzig..."},
                {"n": "100+", "text": "hundert, tausend, eine Million (fem), eine Milliarde (fem), eine Billion (fem)"}
            ]
        }
    }

    # 3. PARSE QUIZZES & DRILLS
    quiz_data = [
        {"id": 1, "type": "modal", "prompt": "Der Junge (wollen) _____ Astronaut werden.", "answer": "will", "verb": "wollen", "explanation": "3rd person singular of wollen is 'will'."},
        {"id": 2, "type": "modal", "prompt": "Pinguine (können) _____ nicht fliegen.", "answer": "können", "verb": "können", "explanation": "Plural subject 'Pinguine' takes 'können'."},
        {"id": 3, "type": "modal", "prompt": "Das Kind (mögen) _____ keinen Käse essen.", "answer": "mag", "verb": "mögen", "explanation": "3rd person singular of mögen is 'mag'."},
        {"id": 4, "type": "modal", "prompt": "Ich (müssen) _____ das Auto waschen.", "answer": "muss", "verb": "müssen", "explanation": "1st person singular of müssen is 'muss'."},
        {"id": 5, "type": "modal", "prompt": "Die Frau (können) _____ fünf Sprachen sprechen.", "answer": "kann", "verb": "können", "explanation": "3rd person singular of können is 'kann'."},
        {"id": 6, "type": "modal", "prompt": "Du (müssen) _____ aufwachen!", "answer": "musst", "verb": "müssen", "explanation": "2nd person singular of müssen is 'musst'."},
        {"id": 7, "type": "modal", "prompt": "(wollen) _____ ihr morgen in den Zoo gehen?", "answer": "Wollt", "verb": "wollen", "explanation": "2nd person plural (ihr) of wollen is 'wollt'."},
        {"id": 8, "type": "modal", "prompt": "(können) _____ du pfeifen?", "answer": "Kannst", "verb": "können", "explanation": "2nd person singular (du) of können is 'kannst'."},
        {"id": 9, "type": "modal", "prompt": "(müssen) _____ ihr nicht gehen? Es ist spät.", "answer": "Müsst", "verb": "müssen", "explanation": "2nd person plural (ihr) of müssen is 'müsst'."},
        {"id": 10, "type": "modal", "prompt": "(wollen) _____ du Chinesisch lernen?", "answer": "Willst", "verb": "wollen", "explanation": "2nd person singular of wollen is 'willst'."},
        {"id": 11, "type": "modal", "prompt": "Susi (können) _____ ihre Uhr nicht finden.", "answer": "kann", "verb": "können", "explanation": "Susi (sie) takes 'kann'."},
        {"id": 12, "type": "modal", "prompt": "Ihr (dürfen) _____ keine Süßigkeiten essen.", "answer": "dürft", "verb": "dürfen", "explanation": "ihr takes 'dürft'."},
        {"id": 13, "type": "modal", "prompt": "Wann (sollen) _____ wir kommen?", "answer": "sollen", "verb": "sollen", "explanation": "wir takes 'sollen'."},
        {"id": 14, "type": "modal", "prompt": "Wo (wollen) _____ die Maiers Urlaub machen?", "answer": "wollen", "verb": "wollen", "explanation": "Die Maiers (plural) takes 'wollen'."},
        {"id": 15, "type": "modal", "prompt": "(müssen) _____ du noch lange arbeiten?", "answer": "Musst", "verb": "müssen", "explanation": "du takes 'musst'."},
        {"id": 16, "type": "modal", "prompt": "Entschuldigung, aber Sie (dürfen) _____ hier nicht rauchen.", "answer": "dürfen", "verb": "dürfen", "explanation": "Formal Sie takes 'dürfen'."},
        {"id": 17, "type": "modal", "prompt": "(können) _____ ihr mir helfen?", "answer": "Könnt", "verb": "können", "explanation": "ihr takes 'könnt'."},
        {"id": 18, "type": "modal", "prompt": "Wie (sollen) _____ ich das allein schaffen?", "answer": "soll", "verb": "sollen", "explanation": "ich takes 'soll'."},
        {"id": 19, "type": "modal", "prompt": "Was (möchten) _____ du zum Frühstück essen?", "answer": "möchtest", "verb": "möchten", "explanation": "du takes 'möchtest'."},
        {"id": 20, "type": "modal", "prompt": "Ein guter Arzt (müssen) _____ freundlich sein.", "answer": "muss", "verb": "müssen", "explanation": "Ein guter Arzt (er) takes 'muss'."},
        {"id": 21, "type": "modal", "prompt": "Er (müssen) _____ 10 km laufen.", "answer": "muss", "verb": "müssen", "explanation": "er takes 'muss'."},
        {"id": 22, "type": "modal", "prompt": "Wir (wollen) _____ ein Lied singen.", "answer": "wollen", "verb": "wollen", "explanation": "wir takes 'wollen'."},
        {"id": 23, "type": "modal", "prompt": "Ich (können) _____ es nicht verstehen.", "answer": "kann", "verb": "können", "explanation": "ich takes 'kann'."},
        {"id": 24, "type": "modal", "prompt": "Sie (pl.) (sollen) _____ das Abendessen kochen.", "answer": "sollen", "verb": "sollen", "explanation": "sie (pl.) takes 'sollen'."},
        {"id": 25, "type": "modal", "prompt": "Wir (müssen) _____ lange warten.", "answer": "müssen", "verb": "müssen", "explanation": "wir takes 'müssen'."},
        {"id": 26, "type": "modal", "prompt": "Ich (wollen) _____ den Film nicht sehen.", "answer": "will", "verb": "wollen", "explanation": "ich takes 'will'."},
        {"id": 27, "type": "modal", "prompt": "Der Vater (sollen) _____ in die Schule kommen.", "answer": "soll", "verb": "sollen", "explanation": "der Vater takes 'soll'."},
        {"id": 28, "type": "modal", "prompt": "Meine Oma (können) _____ nicht Auto fahren.", "answer": "kann", "verb": "können", "explanation": "meine Oma takes 'kann'."},
        {"id": 29, "type": "modal", "prompt": "Der Hund (wollen) _____ immer mit uns spielen.", "answer": "will", "verb": "wollen", "explanation": "der Hund takes 'will'."},
        {"id": 30, "type": "modal", "prompt": "Die Kinder (sollen) _____ um 18 Uhr zu Hause sein.", "answer": "sollen", "verb": "sollen", "explanation": "die Kinder (plural) takes 'sollen'."},
        {"id": 31, "type": "modal", "prompt": "Thomas soll die Bestellung heraussuchen, aber er (können) _____ sie nicht finden.", "answer": "kann", "verb": "können", "explanation": "er takes 'kann'."},
        {"id": 32, "type": "modal", "prompt": "So etwas (dürfen) _____ nicht passieren!", "answer": "darf", "verb": "dürfen", "explanation": "so etwas (es) takes 'darf'."},
        {"id": 33, "type": "modal", "prompt": "Spätestens morgen (wollen) _____ Thomas die Akten sortieren.", "answer": "will", "verb": "wollen", "explanation": "Thomas takes 'will'."},
        {"id": 34, "type": "modal", "prompt": "So etwas Peinliches (sollen) _____ nicht mehr vorkommen.", "answer": "soll", "verb": "sollen", "explanation": "so etwas Peinliches takes 'soll'."},
        {"id": 35, "type": "translation", "prompt": "Translate to German: 'One is not allowed to smoke here.'", "answer": "Man darf hier nicht rauchen.", "explanation": "dürfen expresses permission/prohibition. 'Man darf nicht...' = 'One is not allowed to...'"},
        {"id": 36, "type": "translation", "prompt": "Translate to German: 'One can eat lunch in Google.'", "answer": "Man kann bei Google zu Mittag essen.", "explanation": "'Man kann...' + 'zu Mittag essen' at the end of clause."},
        {"id": 37, "type": "translation", "prompt": "Translate to German: 'One must work a lot.'", "answer": "Man muss viel arbeiten.", "explanation": "müssen for obligation: 'Man muss viel arbeiten.'"},
        {"id": 38, "type": "translation", "prompt": "Translate to German: 'One does not have to eat breakfast.'", "answer": "Man muss nicht frühstücken.", "explanation": "'nicht müssen' means 'do not have to' (not an obligation)."}
    ]

    # 4. PARSE JOURNALS & HOMEWORK
    journal_data = [
        {
            "id": "davos",
            "title": "Wochenende in Davos (Davos Trip)",
            "date": "Juni",
            "original_text": "Wir sind nach Davos für zwei tag gegangen\nWir mögte die Schwimmbad und der fruhstuck\nShelby haben im spielplatz gespielt\nEs gab ein schone festival in de nahe das hotel. Wir haben Wurst, Popcorn und Ice gegessen. Es war super!\nDavos war nicht so schone. Ich weiss bist du zu boarding scholl in Davos gegangen!\nAm wichtigsten, es war kalt!",
            "corrected_text": "Wir sind für zwei Tage nach Davos gefahren.\nWir mochten das Schwimmbad und das Frühstück.\nShelby hat auf dem Spielplatz gespielt.\nEs gab ein schönes Festival in der Nähe des Hotels. Wir haben Wurst, Popcorn und Eis gegessen. Es war super!\nDavos war nicht so schön. Ich weiß, du bist in Davos auf ein Internat gegangen!\nAm wichtigsten: Es war kalt!",
            "corrections": [
                {
                    "original": "für zwei tag gegangen",
                    "corrected": "für zwei Tage ... gefahren",
                    "reason": "Plural of Tag is Tage. Long distance travel uses fahren instead of gehen."
                },
                {
                    "original": "Wir mögte die Schwimmbad und der fruhstuck",
                    "corrected": "Wir mochten das Schwimmbad und das Frühstück",
                    "reason": "Präteritum of mögen for 'wir' is mochten. Das Schwimmbad (neut.) and das Frühstück (neut.)."
                },
                {
                    "original": "Shelby haben im spielplatz gespielt",
                    "corrected": "Shelby hat auf dem Spielplatz gespielt",
                    "reason": "Shelby is singular (hat). German idiom is 'auf dem Spielplatz' (Dativ) rather than 'in'."
                },
                {
                    "original": "in de nahe das hotel",
                    "corrected": "in der Nähe des Hotels",
                    "reason": "Dativ feminine 'in der Nähe' + Genitiv masculine 'des Hotels'."
                },
                {
                    "original": "Ice",
                    "corrected": "Eis",
                    "reason": "German spelling for ice cream is das Eis."
                },
                {
                    "original": "boarding scholl",
                    "corrected": "Internat",
                    "reason": "German word for boarding school is das Internat."
                }
            ]
        },
        {
            "id": "suedtirol",
            "title": "Urlaub in Südtirol (South Tyrol Trip)",
            "date": "Juni",
            "original_text": "Das Hotel war super, perfekt für Kinder und viele spielen, drinner und draußen\nIn de nahe has Hotel, war schone Fluss\nIch wollte die Weltmeisterschaft schauen\nDie Wasserfälle im Bergs war sehr schone! Es gab drei Wasserfälles.",
            "corrected_text": "Das Hotel war super, perfekt für Kinder und viele Spiele, drinnen und draußen.\nIn der Nähe des Hotels gab es einen schönen Fluss.\nIch wollte die Weltmeisterschaft schauen.\nDie Wasserfälle in den Bergen waren sehr schön! Es gab drei Wasserfälle.",
            "corrections": [
                {
                    "original": "viele spielen, drinner und draußen",
                    "corrected": "viele Spiele, drinnen und draußen",
                    "reason": "Spiele (noun, plural). Direction/location is drinnen (inside), not drinner."
                },
                {
                    "original": "In de nahe has Hotel, war schone Fluss",
                    "corrected": "In der Nähe des Hotels gab es einen schönen Fluss",
                    "reason": "'In der Nähe' + Genitiv 'des Hotels' + Akkusativ 'einen schönen Fluss'."
                },
                {
                    "original": "im Bergs war sehr schone",
                    "corrected": "in den Bergen waren sehr schön",
                    "reason": "Plural Dativ: in den Bergen. Plural verb: waren. Adjective: schön without ending as predicate."
                },
                {
                    "original": "drei Wasserfälles",
                    "corrected": "drei Wasserfälle",
                    "reason": "The German plural of der Wasserfall is die Wasserfälle (no -s)."
                }
            ]
        }
    ]

    # Save to JavaScript files with IIFE to prevent global const collision
    with open('data/vocab.js', 'w', encoding='utf-8') as f:
        f.write("// Auto-generated vocabulary data from Hanan Deutsch Notes\n")
        f.write("(function() {\n")
        f.write(f"  const data = {json.dumps(vocab_list, ensure_ascii=False, indent=2)};\n")
        f.write("  if (typeof window !== 'undefined') window.VOCAB_DATA = data;\n")
        f.write("  if (typeof module !== 'undefined' && module.exports) module.exports = { VOCAB_DATA: data };\n")
        f.write("})();\n")

    with open('data/grammar.js', 'w', encoding='utf-8') as f:
        f.write("// Auto-generated grammar data from Hanan Deutsch Cheatsheet\n")
        f.write("(function() {\n")
        f.write(f"  const data = {json.dumps(grammar_data, ensure_ascii=False, indent=2)};\n")
        f.write("  if (typeof window !== 'undefined') window.GRAMMAR_DATA = data;\n")
        f.write("  if (typeof module !== 'undefined' && module.exports) module.exports = { GRAMMAR_DATA: data };\n")
        f.write("})();\n")

    with open('data/quizzes.js', 'w', encoding='utf-8') as f:
        f.write("// Auto-generated quizzes from Hanan Deutsch Notes\n")
        f.write("(function() {\n")
        f.write(f"  const data = {json.dumps(quiz_data, ensure_ascii=False, indent=2)};\n")
        f.write("  if (typeof window !== 'undefined') window.QUIZ_DATA = data;\n")
        f.write("  if (typeof module !== 'undefined' && module.exports) module.exports = { QUIZ_DATA: data };\n")
        f.write("})();\n")

    with open('data/journals.js', 'w', encoding='utf-8') as f:
        f.write("// Auto-generated journal review stories\n")
        f.write("(function() {\n")
        f.write(f"  const data = {json.dumps(journal_data, ensure_ascii=False, indent=2)};\n")
        f.write("  if (typeof window !== 'undefined') window.JOURNAL_DATA = data;\n")
        f.write("  if (typeof module !== 'undefined' && module.exports) module.exports = { JOURNAL_DATA: data };\n")
        f.write("})();\n")

    print("Successfully built all data files in /data directory!")

if __name__ == "__main__":
    build_data()
