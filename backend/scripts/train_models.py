import os

from train_proficiency import train_proficiency
# from backend.train_proficiency_protact import train_proficiency_hybrid
from train_complexity import train_complexity

def train_all_models():
    """Wrapper script to train both proficiency and complexity models."""
    print("=== Training Student Proficiency Model ===")
    
    # Hybrid mode disabled as module is missing
    # use_hybrid = os.getenv("USE_HYBRID_PROFICIENCY", "0") == "1"
    # if use_hybrid:
    #     print("Hybrid mode enabled: DeBERTa + linguistic features")
    #     train_proficiency_hybrid()
    # else:
    train_proficiency()

    print("\n=== Training Text Complexity Model ===")
    train_complexity()
    print("\nAll models have been updated successfully.")

if __name__ == "__main__":
    train_all_models()
