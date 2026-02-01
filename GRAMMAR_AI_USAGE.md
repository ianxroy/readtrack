# Gemini-Enhanced Grammar Checker

## Overview
The grammar checker now supports AI-enhanced mode using Google's Gemini API for better explanations and context-aware suggestions.

## Features

### Basic Mode (Default)
- Uses LanguageTool for English
- Rule-based checking for Tagalog
- Fast, offline-capable
- Good for quick checks

### AI-Enhanced Mode (with Gemini API Key)
- All basic features PLUS:
- **AI Explanations**: Clear, friendly explanations of WHY something is wrong
- **Context-Aware Suggestions**: Better corrections based on full sentence context
- **Overall Feedback**: General writing quality feedback
- **Learning Tips**: Helpful tips to avoid mistakes in the future

## Usage

### Frontend (GrammarChecker Component)

```tsx
import { checkGrammar } from '../services/grammarService';

// Basic mode (no API key needed)
const result = await checkGrammar(text, 'en');

// AI-enhanced mode (with Gemini API key)
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const enhancedResult = await checkGrammar(text, 'en', apiKey);
```

### API Endpoints

#### Basic Grammar Check
```bash
POST /api/grammar/check
{
  "text": "This are a test",
  "language": "en"
}
```

#### AI-Enhanced Grammar Check
```bash
POST /api/grammar/check-enhanced
{
  "text": "This are a test sentence with errors.",
  "language": "en",
  "gemini_api_key": "your-api-key-here"
}
```

### Response Format (AI-Enhanced)

```json
{
  "text": "original text",
  "language": "en",
  "issues": [
    {
      "type": "grammar",
      "message": "Subject-verb agreement error",
      "offset": 0,
      "length": 11,
      "replacements": ["These are", "This is"],
      "context": "This are a test",
      "severity": "error",
      "rule_id": "GRAMMAR_RULE",
      "ai_explanation": "The subject 'This' is singular, so it should be paired with the singular verb 'is' not the plural 'are'. This is a subject-verb agreement error.",
      "ai_suggestion": "This is a test",
      "ai_tip": "Remember: singular subjects (this, that, he, she, it) take singular verbs (is, was, has), while plural subjects (these, those, we, they) take plural verbs (are, were, have)."
    }
  ],
  "issue_count": 1,
  "suggestions_count": 2,
  "corrected_text": "This is a test",
  "ai_overall_feedback": "Your writing has a minor grammar error but is otherwise clear. Focus on subject-verb agreement when writing. Keep practicing - you're doing well!"
}
```

## Component Updates

### Add AI Toggle to GrammarChecker

```tsx
const [useAI, setUseAI] = useState(false);
const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

// In your check function:
const result = await checkGrammar(text, currentLanguage, useAI ? apiKey : undefined);

// Display AI feedback if available:
{result?.ai_overall_feedback && (
  <div className="ai-feedback">
    <h4>✨ AI Writing Feedback</h4>
    <p>{result.ai_overall_feedback}</p>
  </div>
)}

// Display AI explanations in issue cards:
{issue.ai_explanation && (
  <div className="ai-explanation">
    <strong>Why this is wrong:</strong>
    <p>{issue.ai_explanation}</p>
  </div>
)}

{issue.ai_suggestion && (
  <div className="ai-suggestion">
    <strong>Better version:</strong>
    <code>{issue.ai_suggestion}</code>
  </div>
)}
```

## Environment Setup

Add to your `.env.local`:

```env
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

## Benefits

### For Students
- Better understanding of grammar rules
- Contextual learning with explanations
- Encouragement and constructive feedback
- Actionable tips for improvement

### For Teachers
- More detailed error analysis
- Better teaching material from AI explanations
- Context-aware corrections
- Overall writing assessment

## Rate Limits & Costs

- **Basic mode**: Free, unlimited
- **AI mode**: Uses Gemini API (costs apply)
- AI enhancement limited to top 5 errors to manage API calls
- Remaining errors still shown with basic suggestions

## Example Comparison

### Basic Mode
**Error**: "This are a test"
**Message**: "Possible agreement error"
**Suggestions**: ["This is", "These are"]

### AI-Enhanced Mode  
**Error**: "This are a test"
**AI Explanation**: "The subject 'This' is singular, so it should be paired with the singular verb 'is' not the plural 'are'. This is a subject-verb agreement error."
**AI Suggestion**: "This is a test"
**Tip**: "Remember: singular subjects (this, that, he, she, it) take singular verbs (is, was, has)."

## Best Practices

1. **Use Basic Mode** for: Quick checks, fast feedback, offline work
2. **Use AI Mode** for: Learning sessions, detailed feedback, important writing
3. **Combine Both**: Start with basic, then enhance important errors with AI
4. **Cache Results**: Store AI explanations to reduce API calls for common errors

## Future Enhancements

- [ ] Cache common AI explanations
- [ ] Batch API calls for efficiency  
- [ ] Progressive enhancement (show basic first, AI loads async)
- [ ] User preference storage
- [ ] Custom AI prompts for different learning levels
