import calamancy
import sys

def test_calamancy():
    print("--- Testing CalamanCy Installation ---")
    
    # 1. Define the model to load
    # Options usually include: 'tl_calamancy_md-0.1.0', 'tl_calamancy_lg-0.1.0', etc.
    model_name = "tl_calamancy_md-0.1.0"
    
    try:
        print(f"Attempting to load model: {model_name}...")
        nlp = calamancy.load(model_name)
        print("✅ Model loaded successfully.")
        
    except OSError:
        print(f"❌ Error: Could not load '{model_name}'.")
        print(f"Try installing it first via pip: pip install {model_name}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
        sys.exit(1)

    # 2. Process a sample Tagalog sentence
    text = "Si Jose Rizal ay ipinanganak sa Calamba, Laguna."
    print(f"\nProcessing text: '{text}'")
    
    doc = nlp(text)

    # 3. Check for Tokens and POS Tags
    print("\n[Tokens & POS Tags]")
    if len(doc) > 0:
        print(f"{'TOKEN':<15} {'POS':<10} {'LEMMA':<15}")
        print("-" * 40)
        for token in doc:
            print(f"{token.text:<15} {token.pos_:<10} {token.lemma_:<15}")
        print("✅ Tokenization successful.")
    else:
        print("⚠️ No tokens found.")

    # 4. Check for Named Entities
    print("\n[Named Entities]")
    if doc.ents:
        for ent in doc.ents:
            print(f"Entity: {ent.text} | Label: {ent.label_}")
        print("✅ NER successful.")
    else:
        print("ℹ️ No named entities detected in this sample.")

    print("\n--- Test Complete: CalamanCy is working! ---")

if __name__ == "__main__":
    test_calamancy()