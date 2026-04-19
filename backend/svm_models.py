import numpy as np
import pickle
import json
import os
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC


def _map_grammar_issue(issue: dict, text: str):
    """Convert grammar_service GrammarIssue format to frontend GrammarIssue format."""
    # Already in frontend format (has 'original' key) — pass through
    if 'original' in issue:
        return issue

    offset = issue.get('offset', 0)
    length = issue.get('length', 0)
    original = text[offset:offset + length] if text and length > 0 else ''
    if not original:
        return None  # Can't highlight without knowing what text to mark

    replacements = issue.get('replacements', [])
    suggestion = replacements[0] if replacements else original

    issue_type = (issue.get('type') or '').lower()
    severity = (issue.get('severity') or '').lower()
    if 'vocab' in issue_type or 'word choice' in issue_type:
        category = 'vocabulary'
    elif 'style' in issue_type or 'misc' in issue_type:
        category = 'style'
    elif 'clarity' in issue_type:
        category = 'clarity'
    else:
        category = 'grammar'  # default: grammar/spelling/punctuation

    return {
        'original': original,
        'suggestion': suggestion,
        'category': category,
        'context': issue.get('context', ''),
        'explanation': issue.get('message', ''),
    }

class BaseModel:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.labels = []
        self.feature_idx = None  # if set, only these column indices are used

    def load(self, path):

        try:
            with open(path, 'rb') as f:
                data = pickle.load(f)
                self.model = data['model']
                self.scaler = data['scaler']
                self.feature_idx = data.get('feature_idx', None)
            return True
        except FileNotFoundError:
            print(f"Warning: Model file {path} not found. Using heuristics.")
            return False

    def train(self, X, y):
        if self.model is None:
            self.model = SVC(kernel='rbf', C=1.0, gamma='scale', probability=True)
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        print("Model training complete.")

    def _prepare_vector(self, vector):
        """Scales and pads/trims vector to match trained model dimensions. Returns scaled array or None."""
        if not (self.model and hasattr(self.model, 'predict')):
            return None
        try:
            v = np.asarray(vector)
            if v.ndim == 1:
                v = v.reshape(1, -1)
            if self.feature_idx is not None:
                v = v[:, self.feature_idx]

            expected_features = getattr(self.scaler, 'n_features_in_', None)
            if expected_features is None:
                expected_features = getattr(self.model, 'n_features_in_', None)
            if expected_features is None:
                scaler_mean = getattr(self.scaler, 'mean_', None)
                if scaler_mean is not None:
                    expected_features = len(scaler_mean)
            if expected_features is None:
                scaler_scale = getattr(self.scaler, 'scale_', None)
                if scaler_scale is not None:
                    expected_features = len(scaler_scale)
            if expected_features is None:
                support_vectors = getattr(self.model, 'support_vectors_', None)
                if support_vectors is not None and len(getattr(support_vectors, 'shape', [])) == 2:
                    expected_features = int(support_vectors.shape[1])

            # Backward compatibility for older saved models trained on fewer features.
            # If current extractor returns more features, trim extras; if fewer, zero-pad.
            if expected_features is not None and v.shape[1] != expected_features:
                if v.shape[1] > expected_features:
                    v = v[:, :expected_features]
                else:
                    pad_width = expected_features - v.shape[1]
                    v = np.pad(v, ((0, 0), (0, pad_width)), mode='constant')

            return self.scaler.transform(v)
        except Exception as exc:
            print(f"Warning: ML inference skipped, falling back to heuristics ({exc})")
            return None

    def ml_predict(self, vector):
        v_scaled = self._prepare_vector(vector)
        if v_scaled is None:
            return None
        try:
            idx = self.model.predict(v_scaled)[0]
        except Exception as exc:
            print(f"Warning: ML predict failed ({exc})")
            return None
        if isinstance(idx, (int, np.integer)):
            return self.labels[idx]
        return idx

    def ml_predict_proba(self, vector):
        """Returns (label, confidence) or (None, 0) if unavailable."""
        v_scaled = self._prepare_vector(vector)
        if v_scaled is None:
            return None, 0.0
        if not hasattr(self.model, 'predict_proba'):
            return self.ml_predict(vector), 0.0
        try:
            proba = self.model.predict_proba(v_scaled)[0]
            best_idx = int(np.argmax(proba))
            confidence = float(proba[best_idx])
            classes = getattr(self.model, 'classes_', None)
            if classes is not None:
                raw = classes[best_idx]
                label = self.labels[raw] if isinstance(raw, (int, np.integer)) else raw
            else:
                label = self.labels[best_idx] if best_idx < len(self.labels) else None
            return label, confidence
        except Exception as exc:
            print(f"Warning: predict_proba failed ({exc})")
            return None, 0.0

    def _load_metrics(self, model_key):
        base_dir = os.path.dirname(__file__)
        metrics_path = os.path.join(base_dir, 'models', 'evaluation_metrics.json')
        
        default_metrics = {
            "accuracy": "N/A",
            "f1": 0.0,
            "precision": 0.0,
            "recall": 0.0,
            "labels": self.labels,
            "matrix": []
        }
        
        if not os.path.exists(metrics_path):
            return default_metrics
            
        try:
            with open(metrics_path, 'r') as f:
                data = json.load(f)
                return data.get(model_key, default_metrics)
        except Exception:
            return default_metrics

class StudentProficiencySVM(BaseModel):
    def __init__(self):
        super().__init__()
        self.labels = ["Mahusay", "Papaunlad", "Nagsisimula"]

    def get_performance_metrics(self):
        return self._load_metrics("proficiency")

    def predict(self, features_data, text_content, grammar_data=None, rubric_score=None, language='tl'):
        """
        Refactored to integrate real grammar results and Grade 7 specific scaling.
        """
        metrics = features_data['metrics']

        # 1. Grammar Score (0–100) — less punishing for G7 Filipino writers
        if grammar_data and 'issue_count' in grammar_data:
            word_count = metrics.get('wordCount', 1)
            error_count   = len([i for i in grammar_data.get('issues', []) if i.get('severity') == 'error'])
            warning_count = grammar_data.get('issue_count', 0) - error_count
            # Softer penalty: errors cost 2×, warnings 0.5× (was 3× and 1×)
            penalty = ((error_count * 2.0) + (warning_count * 0.5)) / max(word_count, 1) * 100
            grammar_score = max(0, min(100, 100 - penalty))
        else:
            grammar_score = 70.0

        # 2. Pull all available metrics
        vocab_rich     = metrics.get('vocabularyRichness', 0)      # 0–100 (TTR×100)
        struct_coh     = metrics.get('structureCohesion', 0)       # 0–100 (clause density)
        dep_depth      = metrics.get('avgDepDistance', 0) or 0     # avg dependency distance
        discourse      = metrics.get('discourseConnectorRatio', 0) or 0  # 0–1
        sent_std       = metrics.get('sentLenStdDev', 0) or 0      # sentence length variety
        advanced_count = metrics.get('advancedWordCount', 0) or 0  # B2+ word count

        # 3. Normalize new components to 0–100
        # Syntax depth: dep_depth 1–5 typical → (depth−1)/4×100
        syntax_n   = min(100, max(0, (dep_depth - 1) / 4 * 100))
        # Discourse quality: ratio 0–0.5 typical → ×200
        discourse_n = min(100, discourse * 200)
        # Sentence variety: std dev 0–15 words typical → /15×100
        variety_n  = min(100, sent_std / 15 * 100)
        # CEFR B2+ as proper weighted component (was additive, now 5% weight)
        cefr_n     = min(100, advanced_count * 4)

        # 4. Weighted base score — weights sum to 1.0
        calculated_score = (
            grammar_score * 0.25 +   # Grammar accuracy        25%
            vocab_rich    * 0.20 +   # Vocabulary richness     20%
            struct_coh    * 0.15 +   # Clause/structure        15%
            syntax_n      * 0.15 +   # Syntactic depth         15%
            discourse_n   * 0.10 +   # Discourse connectors    10%
            variety_n     * 0.10 +   # Sentence variety        10%
            cefr_n        * 0.05     # Advanced vocabulary      5%
        )

        # 3. Heuristic-primary classification
        # The ASAP2-trained SVM is overconfident (0.78–0.84) for out-of-domain
        # Filipino/G7 essays and collapses predictions to Nagsisimula. The
        # calculated_score is language-agnostic and more reliable here.
        # G7 thresholds calibrated from bilingual evaluation corpus (wc ~80–280 words).
        # Empirical score ranges: Mahusay 55–59, Papaunlad 43–49, Nagsisimula 34–42.
        # Boundaries: Mahusay ≥52 | Papaunlad 42–51 | Nagsisimula <42
        if calculated_score >= 52:
            proficiency = "Mahusay"
        elif calculated_score >= 42:
            proficiency = "Papaunlad"
        else:
            proficiency = "Nagsisimula"
        nat = calculated_score

        band_map = {
            "Mahusay":     ("Enhancement",   "Independent"),
            "Papaunlad":   ("Consolidation", "Instructional"),
            "Nagsisimula": ("Intervention",  "Frustration"),
        }
        band, iri = band_map.get(proficiency, ("Intervention", "Frustration"))

        # If we have a Gemini rubric score (1-5), blend it into natScore
        # rubric is context-aware (PH G7 calibrated); heuristic is structural
        if rubric_score is not None:
            rubric_nat = round((rubric_score / 4.0) * 100, 2)
            nat = round((rubric_nat * 0.6) + (nat * 0.4), 2)
            if nat >= 52:
                proficiency = "Mahusay"
            elif nat >= 42:
                proficiency = "Papaunlad"
            else:
                proficiency = "Nagsisimula"
            band_map = {
                "Mahusay":     ("Enhancement",   "Independent"),
                "Papaunlad":   ("Consolidation", "Instructional"),
                "Nagsisimula": ("Intervention",  "Frustration"),
            }
            band, iri = band_map.get(proficiency, ("Intervention", "Frustration"))

        is_filipino = language in ('tl', 'filipino')
        if is_filipino:
            feedback = (
                f"Antas: {proficiency}. "
                f"Katumpakan ng Gramatika: {round(grammar_score, 1)}%. "
                f"Kayamanan ng Talasalitaan: {round(vocab_rich, 1)}%. "
                f"Istruktura at Pagkakaisa: {round(struct_coh, 1)}%. "
                f"Para sa detalyadong rubrik ng DepEd, tingnan ang Analysis tab."
            )
        else:
            english_level = {
                "Nagsisimula": "Beginning",
                "Papaunlad": "Developing",
                "Mahusay": "Proficient",
            }.get(proficiency, proficiency)
            feedback = (
                f"Level: {english_level}. "
                f"Grammar Accuracy: {round(grammar_score, 1)}%. "
                f"Vocabulary Richness: {round(vocab_rich, 1)}%. "
                f"Structure & Cohesion: {round(struct_coh, 1)}%. "
                f"See the Analysis tab for the full DepEd rubric breakdown."
            )

        return {
            "proficiency": proficiency,
            "feedback": feedback,
            "metrics": {
                "vocabularyRichness": min(100, round(vocab_rich, 2)),
                "sentenceComplexity": round(metrics.get('sentenceComplexity', 0), 2),
                "grammarAccuracy": round(grammar_score, 2), # Now dynamic
                "structureCohesion": round(metrics.get('structureCohesion', 0), 2),
                "cefrDistribution": metrics.get('cefrDistribution', {}),
                "cefrWordsByLevel": metrics.get('cefrWordGroups', {}).get('byLevel', {}),
                "advancedWords": metrics.get('advancedWords', []),
                "readability": metrics.get('readabilityIndices', {})
            },
            "issues": [m for m in (
                _map_grammar_issue(i, text_content)
                for i in (grammar_data.get('issues', []) if grammar_data else [])
            ) if m] if text_content else [],
            "natScore": min(100, round(nat, 2)),
            "learningBand": band,
            "philIriLevel": iri
        }
class TextComplexitySVM(BaseModel):
    def __init__(self):
        super().__init__()
        self.labels = ["Independent", "Instructional", "Frustration"]

    def get_performance_metrics(self):
        return self._load_metrics("complexity")

    def predict(self, features_data, text_content):
        vector = features_data['vector']
        metrics = features_data['metrics']

        ml_label, ml_confidence = self.ml_predict_proba(vector)

        avg_len    = metrics['avgSentenceLength']
        diff_ratio = metrics['difficultWordRatio']

        # --- Full weighted complexity score ---
        # Each component is normalized to 0–100, then weighted.
        ri       = metrics.get('readabilityIndices', {})
        cefr     = metrics.get('cefrDistribution', {})
        tot_cefr = sum(cefr.values()) or 1

        fkgl       = ri.get('flesch_kincaid', 0) or 0
        cefr_ratio = (cefr.get('B2', 0) + cefr.get('C1', 0) + cefr.get('C2', 0)) / tot_cefr
        ttr        = (metrics.get('vocabularyRichness', 0) or 0) / 100
        dep_depth  = metrics.get('avgDepDistance', 0) or 0
        sub_ratio  = metrics.get('subordinationRatio', 0) or 0

        # Normalize each to 0–100
        fkgl_n = min(100, max(0, fkgl / 10 * 100))          # Grade 10 → 100
        cefr_n = min(100, cefr_ratio * 100)                  # 0–1 → 0–100
        sent_n = min(100, max(0, (avg_len - 5) / 20 * 100))  # 5 words=0, 25 words=100
        ttr_n  = min(100, ttr * 100)                         # 0–1 → 0–100
        dep_n  = min(100, max(0, dep_depth * 20))            # depth 5 → 100
        sub_n  = min(100, sub_ratio * 200)                   # 0.5 ratio → 100

        complexity_score = (
            fkgl_n * 0.30 +   # Readability grade level   — strongest predictor
            cefr_n * 0.30 +   # Advanced vocabulary ratio — equally strong
            sent_n * 0.15 +   # Sentence length
            ttr_n  * 0.10 +   # Vocabulary variety
            dep_n  * 0.10 +   # Syntactic depth
            sub_n  * 0.05     # Clause complexity
        )

        # Use the trained SVM when confidence is acceptable; otherwise fall back
        # to explicit readability bands tuned for Grade 7 classroom passages.
        if (
            avg_len >= 28
            or diff_ratio >= 20
            or fkgl >= 23
        ):
            heuristic_level = "Frustration"
        elif (
            avg_len >= 14
            or diff_ratio >= 8
            or fkgl >= 13
        ):
            heuristic_level = "Instructional"
        else:
            heuristic_level = "Independent"

        if ml_label and ml_confidence >= 0.55:
            level = ml_label
            reasoning_label = f"SVM confidence {ml_confidence:.2f}"
        else:
            level = heuristic_level
            reasoning_label = "readability fallback"

        return {
            "level": level,
            "score": min(100, round(complexity_score, 2)),
            "reasoning": (
                f"Classified as {level} using {reasoning_label} "
                f"(L:{avg_len:.1f}, D:{diff_ratio:.1f}%, FK:{fkgl:.1f})."
            ),
            "readabilityScore": max(0, round(100 - complexity_score, 2)),
            "modelConfidence": round(ml_confidence, 4),
            "wordCount": metrics['wordCount'],
            "keywords": metrics['difficultWords'][:5],
            "fixationDuration": min(90, round(30 + (complexity_score * 0.5), 1)),
            "regressionIndex": min(50, round(10 + (diff_ratio * 2), 1)),
            "estimatedReadingTime": round(metrics['wordCount'] / 150, 2),
            "avgSentenceLength": round(avg_len, 2),
            "difficultWordRatio": round(diff_ratio, 2),
            "highlightedSegments": metrics['difficultWords'],
            "readability": metrics.get('readabilityIndices', {}),
            "verbRatio": metrics.get('verbRatio', 0),
            "nounRatio": metrics.get('nounRatio', 0),
            "adjRatio": metrics.get('adjRatio', 0),
            "clauseDensity": metrics.get('clauseDensity', 0),
            "avgDepDistance": metrics.get('avgDepDistance', 0),
            "punctDensity": metrics.get('punctDensity', 0),
            "sentLenStdDev": metrics.get('sentLenStdDev', 0),
        }
