"""Debug: print calculated_score breakdown for each essay."""
import sys, os, json
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)

from preprocessing import extract_features

eval_path = os.path.join(PROJECT_ROOT, "docs", "f1_evaluation_set.json")
with open(eval_path) as f:
    data = json.load(f)

print(f"{'ID':<20} {'GT':<15} {'wc':>5} {'gram':>6} {'voc':>6} {'str':>6} {'syn':>6} {'dis':>6} {'var':>6} {'cef':>6} {'CALC':>7}")
print("-" * 100)

for item in data["student_essays"]:
    lang = "en" if item["language"] == "english" else "tl"
    features = extract_features(item["text"], language=lang)
    metrics = features["metrics"]

    grammar_score = 70.0
    vocab_rich    = metrics.get("vocabularyRichness", 0)
    struct_coh    = metrics.get("structureCohesion", 0)
    dep_depth     = metrics.get("avgDepDistance", 0) or 0
    discourse     = metrics.get("discourseConnectorRatio", 0) or 0
    sent_std      = metrics.get("sentLenStdDev", 0) or 0
    advanced      = metrics.get("advancedWordCount", 0) or 0
    wc            = metrics.get("wordCount", 0)

    syntax_n   = min(100, max(0, (dep_depth - 1) / 4 * 100))
    discourse_n = min(100, discourse * 200)
    variety_n  = min(100, sent_std / 15 * 100)
    cefr_n     = min(100, advanced * 4)

    calc = (
        grammar_score * 0.25 +
        vocab_rich    * 0.20 +
        struct_coh    * 0.15 +
        syntax_n      * 0.15 +
        discourse_n   * 0.10 +
        variety_n     * 0.10 +
        cefr_n        * 0.05
    )

    print(f"{item['id']:<20} {item['ground_truth']:<15} {wc:>5} {grammar_score:>6.1f} {vocab_rich:>6.1f} {struct_coh:>6.1f} {syntax_n:>6.1f} {discourse_n:>6.1f} {variety_n:>6.1f} {cefr_n:>6.1f} {calc:>7.2f}")
