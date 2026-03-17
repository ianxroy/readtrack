import numpy as np
import pickle
import json
import os
from sklearn.preprocessing import StandardScaler

class BaseModel:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.labels = []

    def load(self, path):

        try:
            with open(path, 'rb') as f:
                data = pickle.load(f)
                self.model = data['model']
                self.scaler = data['scaler']
            return True
        except FileNotFoundError:
            print(f"Warning: Model file {path} not found. Using heuristics.")
            return False

    def train(self, X, y):

        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        print("Model training complete.")

    def ml_predict(self, vector):

        if self.model and hasattr(self.model, 'predict'):
            try:
                vector_scaled = self.scaler.transform(vector)
                idx = self.model.predict(vector_scaled)[0]
            except Exception as exc:
                print(f"Warning: ML inference skipped, falling back to heuristics ({exc})")
                return None

            if isinstance(idx, (int, np.integer)):
                return self.labels[idx]
            return idx
        return None

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
        vector = features_data['vector']
        metrics = features_data['metrics']

        # 1. Real Grammar Scoring
        # Instead of a hard-coded 85.0, we calculate a score based on real issues
        if grammar_data and 'issue_count' in grammar_data:
            word_count = metrics.get('wordCount', 1)
            # Weighted error calculation: Errors are penalized more than warnings
            error_count = len([i for i in grammar_data.get('issues', []) if i.get('severity') == 'error'])
            warning_count = grammar_data.get('issue_count', 0) - error_count
            
            # Penalty per word (scaled so it's not too punishing for Grade 7)
            penalty = ((error_count * 3.0) + (warning_count * 1.0)) / max(word_count, 1) * 100
            grammar_score = max(0, min(100, 100 - penalty))
        else:
            grammar_score = 70.0  # Neutral fallback

        # 2. Heuristic Calculation for Grade 7 (Less Strict)
        vocab_rich = metrics['vocabularyRichness']
        struct_coh = metrics['structureCohesion']
        advanced_count = metrics.get('advancedWordCount', 0)

        # Grade 7 specific boost: Encourage using varied words even if not "C2" level
        # We consider B2 as "Advanced" for a 7th Grader
        cefr_boost = min(20, advanced_count * 4) 
        
        # Weighted average for the base score
        # Grammar and Cohesion now heavily influence the calculated_score
        calculated_score = (vocab_rich * 0.3) + (struct_coh * 0.3) + (grammar_score * 0.4) + cefr_boost

        # 3. Hybrid ML-Heuristic Decision
        ml_result = self.ml_predict(vector)
        
        # Less strict classification thresholds for Grade 7
        # Independent: 70+ (was 75) | Instructional: 35+ (was 45)
        if ml_result:
            proficiency = ml_result
            if proficiency == "Mahusay":
                nat = max(70, calculated_score)
            elif proficiency == "Papaunlad":
                nat = max(35, min(74, calculated_score))
            else:
                nat = min(34, calculated_score)
        else:
            if calculated_score >= 70:
                proficiency = "Mahusay"
            elif calculated_score >= 35:
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
            if nat >= 70:
                proficiency = "Mahusay"
            elif nat >= 35:
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
            feedback = (
                f"Level: {proficiency}. "
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
                "advancedWords": metrics.get('advancedWords', []),
                "readability": metrics.get('readabilityIndices', {})
            },
            "issues": grammar_data.get('issues', []) if grammar_data else [],
            "natScore": min(100, round(nat, 2)),
            "learningBand": band,
            "philIriLevel": iri
        }
class TextComplexitySVM(BaseModel):
    def __init__(self):
        super().__init__()
        self.labels = ["Literal", "Inferential", "Evaluative"]

    def get_performance_metrics(self):
        return self._load_metrics("complexity")

    def predict(self, features_data, text_content):
        vector = features_data['vector']
        metrics = features_data['metrics']

        ml_result = self.ml_predict(vector)

        avg_len = metrics['avgSentenceLength']
        diff_ratio = metrics['difficultWordRatio']
        advanced_cefr = metrics.get('advancedWordCount', 0)

        complexity_score = (avg_len * 3) + (diff_ratio * 4) + (advanced_cefr * 3)

        if ml_result:
            level = ml_result
        else:
            if complexity_score < 40:
                level = "Literal"
            elif complexity_score < 75:
                level = "Inferential"
            else:
                level = "Evaluative"

        return {
            "level": level,
            "score": min(100, round(complexity_score, 2)),
            "reasoning": f"Classified as {level} based on linguistic analysis (L:{avg_len:.1f}, D:{diff_ratio:.1f}%).",
            "readabilityScore": max(0, round(100 - complexity_score, 2)),
            "wordCount": metrics['wordCount'],
            "keywords": metrics['difficultWords'][:5],
            "fixationDuration": min(90, round(30 + (complexity_score * 0.5), 1)),
            "regressionIndex": min(50, round(10 + (diff_ratio * 2), 1)),
            "estimatedReadingTime": round(metrics['wordCount'] / 150, 2),
            "avgSentenceLength": round(avg_len, 2),
            "difficultWordRatio": round(diff_ratio, 2),
            "highlightedSegments": metrics['difficultWords'],
            "readability": metrics.get('readabilityIndices', {})
        }
