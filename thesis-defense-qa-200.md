# Thesis Defense Reviewer: ML and NLP (Q&A Format)

Project: ReadTrack  
Date: April 14, 2026

## A. ML and NLP Foundations

1. Q: What is machine learning?
A: Machine learning is when a computer learns patterns from examples.

2. Q: What is NLP?
A: NLP means using computers to process and understand human language.

3. Q: What is an algorithm?
A: An algorithm is a step-by-step way to solve a problem.

4. Q: What is a model?
A: A model is the part of the system that gives predictions.

5. Q: What is training?
A: Training is teaching the model using labeled data.

6. Q: What is inference?
A: Inference is using the trained model on new input.

7. Q: What is a feature?
A: A feature is a measurable text value used by the model.

8. Q: What is a label?
A: A label is the correct class for each training sample.

9. Q: What is classification?
A: Classification means assigning an input to a category.

10. Q: Why is ReadTrack a classification system?
A: It predicts classes like proficiency level and complexity level.

11. Q: What are ReadTrack proficiency labels?
A: Independent, Instructional, and Frustration.

12. Q: What are ReadTrack complexity labels?
A: Independent, Instructional, and Frustration.

13. Q: Why use NLP before ML?
A: NLP converts raw text into numeric features for the model.

14. Q: What is tokenization?
A: Tokenization splits text into words or tokens.

15. Q: What is sentence segmentation?
A: It splits text into sentences.

16. Q: What is POS tagging?
A: POS tagging marks words as noun, verb, adjective, and so on.

17. Q: Why is POS tagging useful?
A: It helps measure grammar and sentence patterns.

18. Q: What is readability?
A: Readability is how easy or hard a text is to read.

19. Q: What readability scores are used?
A: Flesch-Kincaid and Gunning Fog.

20. Q: What is lexical diversity?
A: Lexical diversity means variety of words in the text.

## B. Pipeline and System Flow

21. Q: What is the basic ReadTrack flow?
A: Input text -> NLP processing -> feature extraction -> model prediction -> output labels.

22. Q: What inputs are supported?
A: Plain text, image (OCR), and PDF.

23. Q: How is image text handled?
A: OCR extracts text first, then normal NLP and ML steps run.

24. Q: Why is language selection important?
A: It chooses the correct NLP processing path.

25. Q: What English NLP tools are used?
A: spaCy, LanguageTool, SymSpellPy, and CEFRpy.

26. Q: What Filipino NLP tool is used?
A: calamanCy.

27. Q: What does CEFR-based feature mean?
A: It measures vocabulary levels like A1 to C2.

28. Q: Why do we need feature extraction?
A: Models cannot use raw text directly in this setup.

29. Q: What does the model output aside from class?
A: It can also output confidence information.

30. Q: Why use confidence?
A: It helps identify predictions that need teacher review.

31. Q: What is deterministic processing?
A: Same input gives same output every time.

32. Q: Why include deterministic parts?
A: They give stable baseline results.

33. Q: Why include AI enhancement?
A: It improves contextual suggestions for complex cases.

34. Q: Is AI output final?
A: No, teacher judgment remains final.

35. Q: What is human-in-the-loop?
A: Humans review and correct system outputs.

## C. Algorithms and Model Choice

36. Q: What is SVM in simple terms?
A: SVM draws boundaries that separate classes.

37. Q: Why use SVM for text features?
A: It is strong and stable for structured numeric features.

38. Q: What is a linear kernel?
A: It uses a straight boundary between classes.

39. Q: What is an RBF kernel?
A: It uses curved boundaries for complex class patterns.

40. Q: What is hyperparameter tuning?
A: It is finding the best model settings.

41. Q: What is Grid Search?
A: It tries many setting combinations and picks the best.

42. Q: Why not rely only on one metric during tuning?
A: One metric can hide weaknesses in some classes.

43. Q: What is a baseline model?
A: A simple reference model for comparison.

44. Q: Why compare with baseline?
A: To prove the final model is actually better.

45. Q: What is feature scaling?
A: It makes features comparable in numeric range.

46. Q: Why scale features for SVM?
A: SVM performs better when scales are consistent.

47. Q: What is overfitting?
A: The model memorizes training data and performs poorly on new data.

48. Q: What is underfitting?
A: The model is too simple to learn key patterns.

49. Q: How can overfitting be reduced?
A: Better validation, tuning, and cleaner feature design.

50. Q: What is generalization?
A: Good performance on unseen real-world data.

## D. Metrics and Evaluation

51. Q: What is accuracy?
A: Ratio of correct predictions over total predictions.

52. Q: What is precision?
A: Out of predicted positives, how many are correct.

53. Q: What is recall?
A: Out of actual positives, how many are found.

54. Q: What is F1-score?
A: A single score balancing precision and recall.

55. Q: How is precision computed?
A: Precision = TP / (TP + FP).

56. Q: How is recall computed?
A: Recall = TP / (TP + FN).

57. Q: How is F1 computed?
A: F1 = 2 x (Precision x Recall) / (Precision + Recall).

58. Q: Why is F1 important?
A: It balances false alarms and missed cases.

59. Q: Why is accuracy not enough?
A: It can look high even if one class is weak.

60. Q: What is macro F1?
A: Average F1 across classes with equal weight.

61. Q: What is weighted F1?
A: Average F1 weighted by class size.

62. Q: Why report both macro and weighted F1?
A: They show fairness and overall performance together.

63. Q: What is a confusion matrix?
A: A table showing predicted class versus true class.

64. Q: Why use a confusion matrix?
A: It shows exactly where the model makes mistakes.

65. Q: What is support in a report?
A: Number of samples in each class.

66. Q: What is TP?
A: True Positive, a correct positive prediction.

67. Q: What is FP?
A: False Positive, predicted positive but actually negative.

68. Q: What is FN?
A: False Negative, predicted negative but actually positive.

69. Q: What is TN?
A: True Negative, a correct negative prediction.

70. Q: What does high precision but low recall mean?
A: Few false alarms, but many real cases are missed.

71. Q: What does high recall but low precision mean?
A: Many real cases found, but more false alarms.

72. Q: How do confidence scores help evaluation?
A: Low confidence predictions can be flagged for review.

73. Q: How often should metrics be checked?
A: Regularly, especially after retraining.

74. Q: What is model drift?
A: Model quality drops as real-world data changes.

75. Q: How is drift handled?
A: Monitor metrics and retrain with new verified data.

## E. Data Reliability and Validity

76. Q: Is the data reliable?
A: Reliability is supported through cleaning, checks, and repeatable evaluation.

77. Q: How can we tell data is reliable?
A: Check source quality, label consistency, and stable test performance.

78. Q: What is data quality checking?
A: Checking missing values, duplicates, outliers, and label errors.

79. Q: Why are labels important for reliability?
A: Wrong labels produce wrong model behavior.

80. Q: What is train-test split?
A: Divide data into training and testing sets.

81. Q: Why do we need unseen test data?
A: To estimate real-world performance honestly.

82. Q: What is cross-validation?
A: Repeating train-test cycles on different data splits.

83. Q: Why use cross-validation?
A: It gives more stable and trustworthy performance estimates.

84. Q: What is data leakage?
A: Test information accidentally entering training.

85. Q: Why is leakage dangerous?
A: It gives fake high scores that do not hold in practice.

86. Q: How is leakage prevented?
A: Keep train and test separate and fit preprocessors on train only.

87. Q: What is reproducibility?
A: Getting similar results when repeating the same process.

88. Q: How do we improve reproducibility?
A: Fixed seeds, versioned scripts, and consistent pipelines.

89. Q: What is class imbalance?
A: Some classes have far fewer samples than others.

90. Q: Why is class imbalance risky?
A: Model may ignore smaller classes.

91. Q: How is class imbalance addressed?
A: Balanced strategy and class-aware metrics.

92. Q: What does reliable evaluation look like?
A: Good test design, clear metrics, and transparent error analysis.

93. Q: What is error analysis?
A: Studying wrong predictions to improve the system.

94. Q: What should be shown in error analysis?
A: Common mistakes and what changes were made to fix them.

95. Q: What is a practical reliability statement?
A: The system is reliable for support, but teacher review is still required.

## F. ReadTrack-Specific Defense Points

96. Q: What is the main ML contribution of ReadTrack?
A: It predicts proficiency and complexity from text features in one workflow.

97. Q: What is the main NLP contribution of ReadTrack?
A: It converts multilingual text into structured features usable by ML.

98. Q: Why is hybrid design useful here?
A: It combines speed, consistency, and richer feedback.

99. Q: What does Verify and Train do in simple terms?
A: It uses teacher-corrected data to improve future predictions.

100. Q: Why is teacher correction valuable for ML?
A: It aligns model behavior with real classroom judgment.

101. Q: What role does confidence play in classroom use?
A: It helps teachers decide which outputs need extra checking.

102. Q: Can the system replace teacher grading?
A: No, it supports grading and planning but does not replace teachers.

103. Q: What is a safe way to present model accuracy?
A: Present with F1, precision, recall, and class-level details.

104. Q: Why highlight limitations in defense?
A: It shows scientific honesty and realistic deployment thinking.

105. Q: What limitation should be stated for Filipino NLP?
A: Some feature paths still need further Filipino-specific refinement.

106. Q: What is the next ML improvement step?
A: Retrain with more high-quality teacher-labeled data.

107. Q: What is the next NLP improvement step?
A: Strengthen Filipino feature extraction and validation.

108. Q: What should you say if asked about trust?
A: Trust comes from clear metrics, clean data, and teacher oversight.

109. Q: What should you say if asked about fairness?
A: Check per-class performance and monitor subgroup gaps.

110. Q: What is your short final defense line?
A: ReadTrack uses practical NLP and ML to give fast, useful support while keeping teachers in control.
