import pandas as pd
import numpy as np
import pickle
import os
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
import warnings
warnings.filterwarnings("ignore")

def load_model(model_name):
    """Load trained model and scaler"""
    base_dir = os.path.dirname(__file__)
    model_path = os.path.join(base_dir, 'models', f'{model_name}_model.pkl')
    
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}")
        return None, None
    
    with open(model_path, 'rb') as f:
        saved_data = pickle.load(f)
        model = saved_data['model']
        scaler = saved_data['scaler']
    
    return model, scaler

def evaluate_proficiency_model():
    """Evaluate proficiency model on full dataset with different splits"""
    print("="*70)
    print("PROFICIENCY MODEL EVALUATION")
    print("="*70)
    
    base_dir = os.path.dirname(__file__)
    
    # Load full feature dataset
    features_path = os.path.join(base_dir, 'proficiency_features.csv')
    df = pd.read_csv(features_path)
    
    # Extract features and labels
    feature_cols = [col for col in df.columns if col not in ['label_id', 'label_name']]
    X = df[feature_cols].values
    y = df['label_id'].values
    label_names = ['Independent', 'Instructional', 'Frustration']
    
    print(f"\nDataset: {len(df)} samples, {len(feature_cols)} features")
    print(f"Label distribution:")
    for label_id, label_name in enumerate(label_names):
        count = np.sum(y == label_id)
        print(f"  {label_name}: {count} ({count/len(y)*100:.1f}%)")
    
    # Load trained model
    model, scaler = load_model('proficiency')
    if model is None:
        return None
    
    results = {}
    
    # Evaluate on different train-test splits PLUS full dataset (0-100)
    splits = [(0.6, 0.4), (0.7, 0.3), (0.8, 0.2), (0.0, 1.0)]
    
    for train_size, test_size in splits:
        split_name = f"{int(train_size*100)}-{int(test_size*100)}"
        
        # Check if this is full dataset evaluation (0-100)
        if test_size == 1.0:
            print(f"\n{'='*70}")
            print(f"FULL DATASET EVALUATION (0-100: Testing on 100% of data)")
            print(f"{'='*70}")
            X_test = X
            y_test = y
            print(f"Testing samples: {len(X_test)}")
            
            # Scale and predict on full dataset
            X_test_scaled = scaler.transform(X_test)
            y_pred = model.predict(X_test_scaled)
            
            # Calculate accuracy (no training for full dataset)
            train_accuracy = None
            test_accuracy = accuracy_score(y_test, y_pred)
        else:
            print(f"\n{'='*70}")
            print(f"Split: {split_name} (Training {train_size*100:.0f}% / Testing {test_size*100:.0f}%)")
            print(f"{'='*70}")
            
            # Split data (using same random_state=174 as training)
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=174
            )
            
            print(f"Training samples: {len(X_train)}")
            print(f"Testing samples: {len(X_test)}")
            
            # Scale data
            X_train_scaled = scaler.transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # Predict on both train and test
            y_train_pred = model.predict(X_train_scaled)
            y_pred = model.predict(X_test_scaled)
            
            # Calculate accuracy
            train_accuracy = accuracy_score(y_train, y_train_pred)
            test_accuracy = accuracy_score(y_test, y_pred)
        
        print(f"\n{'*'*70}")
        if train_accuracy is not None:
            print(f"TRAINING ACCURACY: {train_accuracy*100:.1f}%")
        print(f"TEST ACCURACY: {test_accuracy*100:.1f}%")
        print(f"{'*'*70}")
        
        # Classification report
        print("\nTest Set Classification Report:")
        print(classification_report(y_test, y_pred, target_names=label_names, digits=2))
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        
        # Plot confusion matrix
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                    xticklabels=label_names,
                    yticklabels=label_names,
                    cbar_kws={'label': 'Count'})
        if train_accuracy is not None:
            plt.title(f'Proficiency Model - Confusion Matrix ({split_name} Split)\nTrain: {train_accuracy*100:.1f}% | Test: {test_accuracy*100:.1f}%')
        else:
            plt.title(f'Proficiency Model - Full Dataset (0-100)\nTest Accuracy: {test_accuracy*100:.1f}%')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        plt.tight_layout()
        
        # Save confusion matrix
        cm_path = os.path.join(base_dir, 'models', f'proficiency_cm_{split_name}.png')
        plt.savefig(cm_path, dpi=150, bbox_inches='tight')
        print(f"\nConfusion matrix saved to: {cm_path}")
        plt.close()
        
        # Store results
        results[split_name] = {
            'train_accuracy': train_accuracy,
            'test_accuracy': test_accuracy,
            'train_samples': 0 if train_accuracy is None else len(y_train),
            'test_samples': len(X_test),
            'confusion_matrix': cm.tolist()
        }
    
    return results

def evaluate_complexity_model():
    """Evaluate complexity model on full dataset with different splits"""
    print("\n\n")
    print("="*70)
    print("COMPLEXITY MODEL EVALUATION")
    print("="*70)
    
    base_dir = os.path.dirname(__file__)
    
    # Load full feature dataset
    features_path = os.path.join(base_dir, 'complexity_features.csv')
    df = pd.read_csv(features_path)
    
    # Extract features and labels
    feature_cols = [col for col in df.columns if col not in ['label_id', 'label_name']]
    X = df[feature_cols].values
    y = df['label_id'].values
    label_names = ['Literal', 'Inferential', 'Evaluative']
    
    print(f"\nDataset: {len(df)} samples, {len(feature_cols)} features")
    print(f"Label distribution:")
    for label_id, label_name in enumerate(label_names):
        count = np.sum(y == label_id)
        print(f"  {label_name}: {count} ({count/len(y)*100:.1f}%)")
    
    # Load trained model
    model, scaler = load_model('complexity')
    if model is None:
        return None
    
    results = {}
    
    # Evaluate on different train-test splits PLUS full dataset (0-100)
    splits = [(0.6, 0.4), (0.7, 0.3), (0.8, 0.2), (0.0, 1.0)]
    
    for train_size, test_size in splits:
        split_name = f"{int(train_size*100)}-{int(test_size*100)}"
        
        # Check if this is full dataset evaluation (0-100)
        if test_size == 1.0:
            print(f"\n{'='*70}")
            print(f"FULL DATASET EVALUATION (0-100: Testing on 100% of data)")
            print(f"{'='*70}")
            X_test = X
            y_test = y
            print(f"Testing samples: {len(X_test)}")
            
            # Scale and predict on full dataset
            X_test_scaled = scaler.transform(X_test)
            y_pred = model.predict(X_test_scaled)
            
            # Calculate accuracy (no training for full dataset)
            train_accuracy = None
            test_accuracy = accuracy_score(y_test, y_pred)
        else:
            print(f"\n{'='*70}")
            print(f"Split: {split_name} (Training {train_size*100:.0f}% / Testing {test_size*100:.0f}%)")
            print(f"{'='*70}")
            
            # Split data with stratification
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=42, stratify=y
            )
            
            print(f"Training samples: {len(X_train)}")
            print(f"Testing samples: {len(X_test)}")
            
            # Scale data
            X_train_scaled = scaler.transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # Predict on both train and test
            y_train_pred = model.predict(X_train_scaled)
            y_pred = model.predict(X_test_scaled)
            
            # Calculate accuracy
            train_accuracy = accuracy_score(y_train, y_train_pred)
            test_accuracy = accuracy_score(y_test, y_pred)
        
        print(f"\n{'*'*70}")
        if train_accuracy is not None:
            print(f"TRAINING ACCURACY: {train_accuracy*100:.1f}%")
        print(f"TEST ACCURACY: {test_accuracy*100:.1f}%")
        print(f"{'*'*70}")
        
        # Classification report
        print("\nTest Set Classification Report:")
        print(classification_report(y_test, y_pred, target_names=label_names, digits=2))
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        
        # Plot confusion matrix
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Greens',
                    xticklabels=label_names,
                    yticklabels=label_names,
                    cbar_kws={'label': 'Count'})
        if train_accuracy is not None:
            plt.title(f'Complexity Model - Confusion Matrix ({split_name} Split)\nTrain: {train_accuracy*100:.1f}% | Test: {test_accuracy*100:.1f}%')
        else:
            plt.title(f'Complexity Model - Full Dataset (0-100)\nTest Accuracy: {test_accuracy*100:.1f}%')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        plt.tight_layout()
        
        # Save confusion matrix
        cm_path = os.path.join(base_dir, 'models', f'complexity_cm_{split_name}.png')
        plt.savefig(cm_path, dpi=150, bbox_inches='tight')
        print(f"\nConfusion matrix saved to: {cm_path}")
        plt.close()
        
        # Store results
        results[split_name] = {
            'train_accuracy': train_accuracy,
            'test_accuracy': test_accuracy,
            'train_samples': 0 if train_accuracy is None else len(y_train),
            'test_samples': len(X_test),
            'confusion_matrix': cm.tolist()
        }
    
    return results

def create_comparison_table(prof_results, comp_results):
    """Create comparison table - EXCLUDE 0-100 split from table"""
    print("\n\n")
    print("="*70)
    print("MODEL COMPARISON SUMMARY")
    print("="*70)
    
    # Show 0-100 results separately (not in table)
    print("\n" + "="*70)
    print("FULL DATASET RESULTS (0-100) - Not included in table")
    print("="*70)
    if '0-100' in prof_results:
        print(f"Proficiency: {prof_results['0-100']['test_accuracy']*100:.1f}% (all {prof_results['0-100']['test_samples']} samples)")
    if '0-100' in comp_results:
        print(f"Complexity:  {comp_results['0-100']['test_accuracy']*100:.1f}% (all {comp_results['0-100']['test_samples']} samples)")
    
    print("\n" + "="*70)
    print("PROFICIENCY MODEL - Student Reading Level Classification")
    print("="*70)
    print("\nLabels: Independent | Instructional | Frustration")
    print(f"{'Split':<15} {'Train Samples':<15} {'Test Samples':<15} {'Train Acc':<12} {'Test Acc':<12}")
    print("-"*70)
    for split_name in ['60-40', '70-30', '80-20']:  # ONLY these 3
        result = prof_results[split_name]
        print(f"{split_name:<15} {result['train_samples']:<15} {result['test_samples']:<15} {result['train_accuracy']*100:<11.1f}% {result['test_accuracy']*100:<11.1f}%")
    
    print("\n" + "="*70)
    print("COMPLEXITY MODEL - Text Difficulty Classification")
    print("="*70)
    print("\nLabels: Literal | Inferential | Evaluative")
    print(f"{'Split':<15} {'Train Samples':<15} {'Test Samples':<15} {'Train Acc':<12} {'Test Acc':<12}")
    print("-"*70)
    for split_name in ['60-40', '70-30', '80-20']:  # ONLY these 3
        result = comp_results[split_name]
        print(f"{split_name:<15} {result['train_samples']:<15} {result['test_samples']:<15} {result['train_accuracy']*100:<11.1f}% {result['test_accuracy']*100:<11.1f}%")
    
    # Create summary table CSV - ONLY 60-40, 70-30, 80-20
    base_dir = os.path.dirname(__file__)
    
    # Proficiency table
    prof_data = []
    for split_name in ['60-40', '70-30', '80-20']:  # EXCLUDE 0-100
        result = prof_results[split_name]
        prof_data.append({
            'Model': 'Student Proficiency',
            'Split': split_name,
            'Training_Samples': result['train_samples'],
            'Testing_Samples': result['test_samples'],
            'Training_Accuracy': f"{result['train_accuracy']*100:.1f}%",
            'Testing_Accuracy': f"{result['test_accuracy']*100:.1f}%"
        })
    
    # Complexity table
    comp_data = []
    for split_name in ['60-40', '70-30', '80-20']:  # EXCLUDE 0-100
        result = comp_results[split_name]
        comp_data.append({
            'Model': 'Text Complexity',
            'Split': split_name,
            'Training_Samples': result['train_samples'],
            'Testing_Samples': result['test_samples'],
            'Training_Accuracy': f"{result['train_accuracy']*100:.1f}%",
            'Testing_Accuracy': f"{result['test_accuracy']*100:.1f}%"
        })
    
    # Combine and save
    df_summary = pd.DataFrame(prof_data + comp_data)
    summary_path = os.path.join(base_dir, 'model_comparison_summary.csv')
    df_summary.to_csv(summary_path, index=False)
    print(f"\n✓ Summary table saved to: {summary_path}")
    print("  (Note: 0-100 results excluded from table as requested)")
    
    return df_summary

def main():
    print("\n" + "="*70)
    print("READTRACK MODEL EVALUATION SUITE")
    print("="*70)
    print("\nEvaluating trained models with 60-40, 70-30, 80-20, and 0-100 splits...")
    print("(0-100 results will be shown but NOT included in summary table)\n")
    
    # Evaluate proficiency model
    prof_results = evaluate_proficiency_model()
    
    if prof_results is None:
        print("\n✗ Proficiency model evaluation failed")
        return
    
    # Evaluate complexity model
    comp_results = evaluate_complexity_model()
    
    if comp_results is None:
        print("\n✗ Complexity model evaluation failed")
        return
    
    # Create comparison table (excludes 0-100)
    df_summary = create_comparison_table(prof_results, comp_results)
    
    print("\n" + "="*70)
    print("EVALUATION COMPLETE!")
    print("="*70)
    print("\nGenerated files:")
    print("  • Proficiency confusion matrices: proficiency_cm_60-40.png, proficiency_cm_70-30.png, proficiency_cm_80-20.png, proficiency_cm_0-100.png")
    print("  • Complexity confusion matrices: complexity_cm_60-40.png, complexity_cm_70-30.png, complexity_cm_80-20.png, complexity_cm_0-100.png")
    print("  • Summary table: model_comparison_summary.csv (only 60-40, 70-30, 80-20)")
    print("\n")

if __name__ == "__main__":
    main()
