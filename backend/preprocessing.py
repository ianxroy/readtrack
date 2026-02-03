import re
import unicodedata
import numpy as np
import spacy
from cefrpy import CEFRSpaCyAnalyzer, CEFRLevel

# Initialize the spaCy-integrated CEFR analyzer
analyzer = CEFRSpaCyAnalyzer()

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print("Spacy model 'en_core_web_sm' not found.")
    print("Please run: python -m spacy download en_core_web_sm")
    nlp = None

def clean_text(text):
    """Basic text cleaning with Unicode normalization."""
    # Normalize Unicode to NFC form to handle diacritics and special characters properly
    text = unicodedata.normalize('NFC', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def calculate_ttr(tokens):
    """Calculate Type-Token Ratio (Lexical Diversity)."""
    if not tokens:
        return 0
    unique_types = set(t.lower() for t in tokens)
    return len(unique_types) / len(tokens)

def get_cefr_distribution(doc):
    """Identify CEFR levels of words using cefrpy and a spaCy doc."""
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
    """Group words by CEFR bands for basic, independent, and proficient vocab."""
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
    """Identify complex words (placeholder logic: > 2 syllables or length > 9)."""
    difficult = []
    for token in tokens:
        if len(token) > 9:
            difficult.append(token)
    return difficult

def extract_features(text, language="en"):
    """
    Converts raw text into a numerical feature vector for the SVM.
    Returns a dictionary of features and the raw vector.
    CEFR analysis is only applied for English text.
    """
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
    
    # Only apply CEFR analysis for English text
    if language == "en":
        cefr_dist, advanced_cefr_count = get_cefr_distribution(doc)
        cefr_word_groups = get_cefr_word_groups(doc)
    else:
        # For non-English languages (e.g., Tagalog), skip CEFR analysis
        cefr_dist = {"A1": 0, "A2": 0, "B1": 0, "B2": 0, "C1": 0, "C2": 0}
        advanced_cefr_count = 0
        cefr_word_groups = {"basic": [], "independent": [], "proficient": []}
    
    advanced_ratio = advanced_cefr_count / word_count if word_count > 0 else 0

    clause_density = 0
    structure_score = 0
    
    if nlp:
        doc = nlp(text)
        verb_count = len([token for token in doc if token.pos_ == "VERB"])
        clause_density = verb_count / sentence_count if sentence_count > 0 else 0
        structure_score = min(100, (clause_density * 10) + (avg_sentence_length * 2))

    difficult_words = get_difficult_words(words)
    diff_ratio = (len(difficult_words) / word_count) * 100 if word_count > 0 else 0
    
    feature_vector = np.array([ttr, avg_sentence_length, diff_ratio, clause_density, advanced_ratio]).reshape(1, -1)
    
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
            "advancedWords": cefr_word_groups.get("proficient", [])
        }
    }
