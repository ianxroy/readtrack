import numpy as np
import pickle
import json
import os
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
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
            vector_scaled = self.scaler.transform(vector)
            idx = self.model.predict(vector_scaled)[0]

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
        # Switched to RandomForest for better non-linear performance
        self.model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
        self.labels = ["Independent", "Instructional", "Frustration"]

    def get_performance_metrics(self):
        return self._load_metrics("proficiency")

    def predict(self, features_data, text_content):
        vector = features_data['vector']
        metrics = features_data['metrics']

        ml_result = self.ml_predict(vector)

        vocab_rich = metrics['vocabularyRichness']
        struct_coh = metrics['structureCohesion']
        advanced_count = metrics.get('advancedWordCount', 0)

        cefr_boost = min(15, advanced_count * 2) if advanced_count > 0 else 0
        score = (vocab_rich * 0.4) + (struct_coh * 0.6) + cefr_boost

        if ml_result:
            proficiency = ml_result

            label_map = {"Independent": 90, "Instructional": 65, "Frustration": 35}
            nat = label_map.get(proficiency, score)
        else:
            if score >= 80:
                proficiency = "Independent"
            elif score >= 50:
                proficiency = "Instructional"
            else:
                proficiency = "Frustration"
            nat = score

        band_map = {
            "Independent": ("Enhancement", "Independent"),
            "Instructional": ("Consolidation", "Instructional"),
            "Frustration": ("Intervention", "Frustration")
        }
        band, iri = band_map.get(proficiency, ("Intervention", "Frustration"))

        feedback_str = f"Rated as {proficiency}. "
        if advanced_count > 0:
            feedback_str += f"Detected {advanced_count} CEFR Advanced (C1/C2) words. "

        issues = []
        if "very good" in text_content.lower():
            issues.append({"original": "very good", "suggestion": "excellent", "category": "VOCABULARY"})

        return {
            "proficiency": proficiency,
            "feedback": feedback_str,
            "metrics": {
                "vocabularyRichness": min(100, round(vocab_rich + cefr_boost, 2)),
                "sentenceComplexity": round(metrics['avgSentenceLength'] * 2, 2),
                "grammarAccuracy": 85.0,
                "structureCohesion": round(struct_coh, 2),
                "cefrDistribution": metrics.get('cefrDistribution', {}),
                "advancedWords": metrics.get('advancedWords', []),
                "readability": metrics.get('readabilityIndices', {})
            },
            "issues": issues,
            "natScore": min(99, round(nat, 2)),
            "learningBand": band,
            "philIriLevel": iri
        }

class TextComplexitySVM(BaseModel):
    def __init__(self):
        super().__init__()
        self.model = SVC(kernel='linear', probability=True)
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
