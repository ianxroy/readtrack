import re
import unicodedata
import numpy as np
import spacy
from cefrpy import CEFRSpaCyAnalyzer, CEFRLevel

analyzer = CEFRSpaCyAnalyzer()

try:
    # Disable components not used in extract_features to speed up processing
    nlp = spacy.load("en_core_web_sm", disable=["ner", "lemmatizer", "attribute_ruler"])
except OSError:
    print("Spacy model 'en_core_web_sm' not found.")
    print("Please run: python -m spacy download en_core_web_sm")
    nlp = None

def clean_text(text):

    text = unicodedata.normalize('NFC', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def calculate_ttr(tokens):

    if not tokens:
        return 0
    unique_types = set(t.lower() for t in tokens)
    return len(unique_types) / len(tokens)

def get_cefr_distribution(doc):

    levels = {"A1": 0, "A2": 0, "B1": 0, "B2": 0, "C1": 0, "C2": 0}
    advanced_count = 0

    cefr_tokens = analyzer.analize_doc(doc)

    for token_data in cefr_tokens:
        is_skipped, level = token_data[2], token_data[3]

        if not is_skipped and level is not None:
            cefr_rank = round(level)
            if 1 <= cefr_rank <= 6:
                cefr_level_str = CEFRLevel(cefr_rank).name
                if cefr_level_str in levels:
                    levels[cefr_level_str] += 1
                    if cefr_rank >= 5:
                        advanced_count += 1

    return levels, advanced_count

def get_cefr_word_groups(doc):

    groups = {
        "basic": set(),
        "independent": set(),
        "proficient": set()
    }

    cefr_tokens = analyzer.analize_doc(doc)
    for token_data in cefr_tokens:
        word, _, is_skipped, level = token_data[0], token_data[1], token_data[2], token_data[3]
        if is_skipped or level is None:
            continue
        cefr_rank = round(level)
        if 1 <= cefr_rank <= 6:
            if cefr_rank <= 2:
                groups["basic"].add(word.lower())
            elif cefr_rank <= 4:
                groups["independent"].add(word.lower())
            else:
                groups["proficient"].add(word.lower())

    return {
        "basic": sorted(groups["basic"]),
        "independent": sorted(groups["independent"]),
        "proficient": sorted(groups["proficient"])
    }

def get_difficult_words(tokens):

    difficult = []
    for token in tokens:
        if len(token) > 9:
            difficult.append(token)
    return difficult

def count_syllables(word):

    word = word.lower()
    count = 0
    vowels = "aeiouy"
    if not word: return 0
    if word[0] in vowels:
        count += 1
    for index in range(1, len(word)):
        if word[index] in vowels and word[index - 1] not in vowels:
            count += 1
    if word.endswith("e"):
        count -= 1
    if count == 0:
        count += 1
    return count

def calculate_readability(word_count, sentence_count, syllable_count, complex_word_count):

    if word_count == 0 or sentence_count == 0:
        return {"flesch_kincaid": 0, "ari": 0, "gunning_fog": 0}

    fk = (0.39 * (word_count / sentence_count)) + (11.8 * (syllable_count / word_count)) - 15.59

    fog = 0.4 * ((word_count / sentence_count) + 100 * (complex_word_count / word_count))

    return {
        "flesch_kincaid": round(max(0, fk), 2),
        "gunning_fog": round(max(0, fog), 2)
    }

def extract_features(text, language="en"):

    if not nlp:
        raise RuntimeError("spaCy model is not loaded. Cannot extract features.")

    text = clean_text(text)
    doc = nlp(text)

    sentences = list(doc.sents)
    tokens = [token.text for token in doc]
    words = [token.text for token in doc if token.is_alpha]

    word_count = len(words)
    sentence_count = len(sentences)
    avg_sentence_length = word_count / sentence_count if sentence_count > 0 else 0
    ttr = calculate_ttr(words)

    total_syllables = sum(count_syllables(w) for w in words)
    difficult_words = get_difficult_words(words)
    readability = calculate_readability(word_count, sentence_count, total_syllables, len(difficult_words))

    if language == "en":
        cefr_dist, advanced_cefr_count = get_cefr_distribution(doc)
        cefr_word_groups = get_cefr_word_groups(doc)
    else:

        cefr_dist = {"A1": 0, "A2": 0, "B1": 0, "B2": 0, "C1": 0, "C2": 0}
        advanced_cefr_count = 0
        cefr_word_groups = {"basic": [], "independent": [], "proficient": []}

    advanced_ratio = advanced_cefr_count / word_count if word_count > 0 else 0
    
    # CEFR Level Distribution as Features
    cefr_ratios = []
    for level in ["A1", "A2", "B1", "B2", "C1", "C2"]:
        count = cefr_dist.get(level, 0)
        cefr_ratios.append(count / word_count if word_count > 0 else 0)

    clause_density = 0
    structure_score = 0

    # Transition words for cohesion analysis
    transitions = {"however", "therefore", "furthermore", "consequently", "specifically", 
                   "moreover", "additionally", "nevertheless", "conversely", "meanwhile"}
    trans_count = len([w for w in words if w.lower() in transitions])
    trans_ratio = trans_count / sentence_count if sentence_count > 0 else 0

    if nlp:
        verbs = [token.text.lower() for token in doc if token.pos_ == "VERB"]
        nouns = [token.text.lower() for token in doc if token.pos_ == "NOUN"]
        
        verb_diversity = len(set(verbs)) / len(verbs) if verbs else 0
        noun_diversity = len(set(nouns)) / len(nouns) if nouns else 0

        verb_count = len(verbs)
        noun_count = len(nouns)
        adj_count = len([token for token in doc if token.pos_ == "ADJ"])
        adv_count = len([token for token in doc if token.pos_ == "ADV"])
        
        # Calculate ratios
        verb_ratio = verb_count / word_count if word_count > 0 else 0
        noun_ratio = noun_count / word_count if word_count > 0 else 0
        adj_ratio = adj_count / word_count if word_count > 0 else 0
        
        # New Stylistic Markers for 90% Goal
        pronoun_count = len([token for token in doc if token.pos_ == "PRON"])
        conj_count = len([token for token in doc if token.pos_ == "CONJ" or token.pos_ == "CCONJ"])
        pronoun_ratio = pronoun_count / word_count if word_count > 0 else 0
        conj_ratio = conj_count / sentence_count if sentence_count > 0 else 0

        # Syntactic Complexity (Tree Depth estimate via dependency distance)
        dep_distance = 0
        for token in doc:
            if token.head != token:
                dep_distance += abs(token.i - token.head.i)
        avg_dep_distance = dep_distance / word_count if word_count > 0 else 0

        clause_density = verb_count / sentence_count if sentence_count > 0 else 0
        structure_score = min(100, (clause_density * 10) + (avg_sentence_length * 2))

    diff_ratio = (len(difficult_words) / word_count) * 100 if word_count > 0 else 0

    # New Features for 85% Accuracy Goal
    punctuation_count = len([token for token in doc if token.is_punct])
    punct_density = punctuation_count / word_count if word_count > 0 else 0
    
    stopword_count = len([token for token in doc if token.is_stop])
    stopword_ratio = stopword_count / word_count if word_count > 0 else 0
    
    avg_word_length = np.mean([len(w) for w in words]) if words else 0
    unique_word_count = len(set(w.lower() for w in words))
    syllables_per_word = total_syllables / word_count if word_count > 0 else 0

    # Sentence length variance (Burstiness)
    sent_lengths = [len(s.text.split()) for s in sentences]
    sent_len_std = np.std(sent_lengths) if sent_lengths else 0

    # Logical Structure for 90% Push
    logic_words = {"if", "then", "because", "so", "unless", "since", "due to", "resulting in"}
    logic_count = len([w for w in words if w.lower() in logic_words])
    logic_ratio = logic_count / word_count if word_count > 0 else 0
    
    paragraph_count = text.count('\n\n') + 1
    para_ratio = paragraph_count / sentence_count if sentence_count > 0 else 0

    feature_vector = np.array([
        ttr,
        avg_sentence_length,
        diff_ratio,
        clause_density,
        advanced_ratio,
        readability['flesch_kincaid'],
        readability['gunning_fog'],
        verb_ratio,
        noun_ratio,
        adj_ratio,
        avg_dep_distance,
        word_count,
        sentence_count,
        sent_len_std,
        # New dimensions
        punct_density,
        stopword_ratio,
        avg_word_length,
        syllables_per_word,
        # CEFR distribution
        *cefr_ratios,
        # Interaction Features for 85% Accuracy Goal
        avg_sentence_length * advanced_ratio,
        ttr * syllables_per_word,
        clause_density * punct_density,
        # Cohesion & Diversity (The 90% Push)
        trans_ratio,
        verb_diversity,
        noun_diversity,
        # Final Ceiling Features
        len(set(token.text for token in doc if token.is_punct)) / word_count if word_count > 0 else 0,
        sent_len_std / avg_sentence_length if avg_sentence_length > 0 else 0,
        advanced_ratio * ttr,
        # Pronoun ratio (captures personal narratives)
        pronoun_ratio,
        conj_ratio,
        # 90% Logic & Structure
        logic_ratio,
        para_ratio
    ]).reshape(1, -1)

    return {
        "vector": feature_vector,
        "metrics": {
            "wordCount": word_count,
            "avgSentenceLength": avg_sentence_length,
            "vocabularyRichness": ttr * 100,
            "difficultWordRatio": diff_ratio,
            "structureCohesion": structure_score,
            "difficultWords": difficult_words,
            "cefrDistribution": cefr_dist,
            "advancedWordCount": advanced_cefr_count,
            "cefrWordGroups": cefr_word_groups,
            "advancedWords": cefr_word_groups.get("proficient", []),
            "readabilityIndices": readability
        }
    }
