import React, { useState, useEffect } from 'react';
import {
  checkGrammar,
  GrammarCheckResponse,
  GrammarIssue,
  getIssueStats,
  createDebouncedGrammarCheck
} from '../services/grammarService';

interface GrammarCheckerProps {
  initialText?: string;
  onTextChange?: (text: string) => void;
}

const GrammarChecker: React.FC<GrammarCheckerProps> = ({
  initialText = '',
  onTextChange
}) => {
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState<GrammarCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<GrammarIssue | null>(null);
  const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

  const debouncedCheck = createDebouncedGrammarCheck(1500);

  useEffect(() => {
    if (text.length > 0) {
      debouncedCheck(text, (checkResult) => {
        setResult(checkResult);
        setLoading(false);
      }, geminiApiKey);
      setLoading(true);
    } else {
      setResult(null);
    }
  }, [text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    onTextChange?.(newText);
  };

  const applySuggestion = (issue: GrammarIssue, suggestion: string) => {
    const before = text.slice(0, issue.offset);
    const after = text.slice(issue.offset + issue.length);
    const newText = before + suggestion + after;
    setText(newText);
    onTextChange?.(newText);
    setSelectedIssue(null);
  };

  const getLineNumbers = () => {
    const lines = text.split('\n').length;
    return Array.from({ length: lines }, (_, i) => i + 1);
  };

  const getHighlightedText = () => {
    if (!result || result.issues.length === 0) {
      return text;
    }

    let highlightedText = '';
    let lastIndex = 0;

    const sortedIssues = [...result.issues].sort((a, b) => a.offset - b.offset);

    sortedIssues.forEach((issue) => {
      highlightedText += escapeHtml(text.slice(lastIndex, issue.offset));

      const issueText = text.slice(issue.offset, issue.offset + issue.length);
      const className = `highlight-${issue.severity}`;
      const title = issue.message;

      highlightedText += `<span class="${className}" title="${escapeHtml(title)}" data-issue-id="${sortedIssues.indexOf(issue)}">${escapeHtml(issueText)}</span>`;

      lastIndex = issue.offset + issue.length;
    });

    highlightedText += escapeHtml(text.slice(lastIndex));

    return highlightedText.replace(/\n/g, '<br>');
  };

  const escapeHtml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const stats = result ? getIssueStats(result.issues) : null;

  return (
    <div className="grammar-checker">
      {result && (
        <div className="language-indicator">
          <span className="indicator-icon">🌐</span>
          <span className="indicator-label">Detected:</span>
          <span className="indicator-language">
            {result.detected_language === 'en' ? 'English' : 'Filipino'}
          </span>
          {geminiApiKey && (
            <span className="ai-badge">✨ AI Enhanced</span>
          )}
        </div>
      )}

      {result?.ai_overall_feedback && (
        <div className="ai-overall-feedback">
          <div className="ai-feedback-header">
            <span className="ai-icon">✨</span>
            <h4>AI Writing Coach</h4>
          </div>
          <p>{result.ai_overall_feedback}</p>
        </div>
      )}

      <div className="text-input-container">
        <div className="line-numbers">
          {getLineNumbers().map((num) => (
            <div key={num} className="line-number">
              {num}
            </div>
          ))}
        </div>

        <div className="editor-wrapper">
          <div
            className="text-highlight-overlay"
            dangerouslySetInnerHTML={{ __html: getHighlightedText() }}
          />
          <textarea
            value={text}
            onChange={handleTextChange}
            placeholder="Enter text to check (English or Filipino)..."
            rows={10}
            className="text-input"
            spellCheck={false}
          />
        </div>

        {loading && (
          <div className="loading-indicator">
            Checking grammar...
          </div>
        )}
      </div>

      {stats && (
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-label">Total Issues:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat error">
            <span className="stat-label">Errors:</span>
            <span className="stat-value">{stats.errors}</span>
          </div>
          <div className="stat warning">
            <span className="stat-label">Warnings:</span>
            <span className="stat-value">{stats.warnings}</span>
          </div>
        </div>
      )}

      {result && result.issues.length > 0 && (
        <div className="issues-panel">
          <h3>Issues Found</h3>

          <div className="issues-list">
            {result.issues.map((issue, index) => (
              <div
                key={index}
                className={`issue-item ${issue.severity} ${selectedIssue === issue ? 'selected' : ''}`}
                onClick={() => setSelectedIssue(issue)}
              >
                <div className="issue-header">
                  <span className={`severity-badge ${issue.severity}`}>
                    {issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : 'ℹ️'}
                    {issue.type}
                  </span>
                  <span className="issue-position">
                    Line {Math.floor(issue.offset / 50) + 1}
                  </span>
                </div>

                <div className="issue-message">{issue.message}</div>

                {issue.ai_explanation && (
                  <div className="ai-explanation">
                    <div className="ai-label">
                      <span className="ai-icon">💡</span>
                      <strong>AI Explanation:</strong>
                    </div>
                    <p>{issue.ai_explanation}</p>
                  </div>
                )}

                {issue.ai_suggestion && (
                  <div className="ai-better-suggestion">
                    <div className="ai-label">
                      <span className="ai-icon">✨</span>
                      <strong>AI Suggested Fix:</strong>
                    </div>
                    <code>{issue.ai_suggestion}</code>
                    <button
                      className="suggestion-btn ai-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        applySuggestion(issue, issue.ai_suggestion!);
                      }}
                    >
                      Apply AI Fix
                    </button>
                  </div>
                )}

                <div className="issue-context">
                  <code>{issue.context}</code>
                </div>

                {issue.replacements.length > 0 && !issue.ai_suggestion && (
                  <div className="issue-suggestions">
                    <span className="suggestions-label">Suggestions:</span>
                    {issue.replacements.map((suggestion, idx) => (
                      <button
                        key={idx}
                        className="suggestion-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          applySuggestion(issue, suggestion);
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result && result.issues.length === 0 && (
        <div className="no-issues">
          <span className="success-icon">✓</span>
          <p>No issues found! Your text looks great.</p>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .grammar-checker {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }

        .language-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 20px;
          background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
          border: 2px solid #667eea;
          border-radius: 10px;
          margin-bottom: 20px;
          font-size: 16px;
        }

        .indicator-icon {
          font-size: 24px;
        }

        .indicator-label {
          color: #666;
          font-weight: 500;
        }

        .indicator-language {
          color: #667eea;
          font-weight: bold;
          font-size: 18px;
        }

        .ai-badge {
          margin-left: auto;
          padding: 5px 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
          animation: sparkle 2s ease-in-out infinite;
        }

        @keyframes sparkle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.05); }
        }

        .ai-overall-feedback {
          background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
          border: 2px solid #667eea;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.1);
        }

        .ai-feedback-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .ai-feedback-header h4 {
          margin: 0;
          color: #667eea;
          font-size: 18px;
        }

        .ai-icon {
          font-size: 24px;
          animation: sparkle 2s ease-in-out infinite;
        }

        @keyframes sparkle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }

        .ai-overall-feedback p {
          margin: 0;
          color: #555;
          line-height: 1.6;
        }

        .ai-explanation {
          background: #f0f4ff;
          border-left: 4px solid #667eea;
          padding: 12px;
          margin: 10px 0;
          border-radius: 5px;
        }

        .ai-label {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 8px;
        }

        .ai-label strong {
          color: #667eea;
          font-size: 14px;
        }

        .ai-explanation p {
          margin: 0;
          color: #555;
          font-size: 14px;
          line-height: 1.5;
        }

        .ai-better-suggestion {
          background: #f3f0ff;
          border-left: 4px solid #9C27B0;
          padding: 12px;
          margin: 10px 0;
          border-radius: 5px;
        }

        .ai-better-suggestion code {
          display: block;
          background: white;
          padding: 10px;
          border-radius: 3px;
          margin: 8px 0;
          color: #2196F3;
          font-weight: 500;
        }

        .ai-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin-top: 8px;
        }

        .ai-btn:hover {
          background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
          box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
        }

        .text-input-container {
          position: relative;
          margin-bottom: 20px;
          display: flex;
          gap: 10px;
        }

        .line-numbers {
          display: flex;
          flex-direction: column;
          background: #f5f5f5;
          padding: 15px 10px;
          border: 2px solid #ddd;
          border-right: none;
          border-radius: 5px 0 0 5px;
          user-select: none;
          min-width: 40px;
          text-align: right;
        }

        .line-number {
          font-family: monospace;
          font-size: 14px;
          color: #666;
          line-height: 1.5;
          height: 21px;
        }

        .editor-wrapper {
          position: relative;
          flex: 1;
        }

        .text-highlight-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 15px;
          font-size: 16px;
          font-family: inherit;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: transparent;
          pointer-events: none;
          overflow: hidden;
          line-height: 1.5;
          border: 2px solid transparent;
        }

        .text-input {
          width: 100%;
          height: 100%;
          padding: 15px;
          font-size: 16px;
          border: 2px solid #ddd;
          border-radius: 0 5px 5px 0;
          font-family: inherit;
          resize: vertical;
          background: transparent;
          position: relative;
          z-index: 1;
          color: #333;
          line-height: 1.5;
        }

        .text-input:focus {
          outline: none;
          border-color: #4CAF50;
        }

        .highlight-error {
          background-color: rgba(244, 67, 54, 0.2);
          border-bottom: 2px solid #f44336;
          cursor: pointer;
          position: relative;
        }

        .highlight-warning {
          background-color: rgba(255, 152, 0, 0.2);
          border-bottom: 2px wavy #ff9800;
          cursor: pointer;
          position: relative;
        }

        .highlight-info {
          background-color: rgba(33, 150, 243, 0.2);
          border-bottom: 1px dotted #2196F3;
          cursor: pointer;
          position: relative;
        }

        .loading-indicator {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(76, 175, 80, 0.9);
          color: white;
          padding: 5px 10px;
          border-radius: 3px;
          font-size: 12px;
        }

        .stats-bar {
          display: flex;
          gap: 20px;
          align-items: center;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 5px;
          margin-bottom: 20px;
        }

        .stat {
          display: flex;
          gap: 5px;
          align-items: center;
        }

        .stat-label {
          font-weight: 500;
        }

        .stat-value {
          font-weight: bold;
          font-size: 18px;
        }

        .stat.error .stat-value {
          color: #f44336;
        }

        .stat.warning .stat-value {
          color: #ff9800;
        }

        .issues-panel {
          background: white;
          border: 1px solid #ddd;
          border-radius: 5px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .issues-panel h3 {
          margin-top: 0;
        }

        .issues-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .issue-item {
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .issue-item:hover {
          background: #f9f9f9;
          border-color: #4CAF50;
        }

        .issue-item.selected {
          border-color: #4CAF50;
          background: #f0f8f0;
        }

        .issue-item.error {
          border-left: 4px solid #f44336;
        }

        .issue-item.warning {
          border-left: 4px solid #ff9800;
        }

        .issue-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .severity-badge {
          padding: 3px 8px;
          border-radius: 3px;
          font-size: 12px;
          font-weight: 500;
        }

        .severity-badge.error {
          background: #ffebee;
          color: #c62828;
        }

        .severity-badge.warning {
          background: #fff3e0;
          color: #e65100;
        }

        .issue-message {
          margin-bottom: 10px;
          font-weight: 500;
        }

        .issue-context {
          background: #f5f5f5;
          padding: 8px;
          border-radius: 3px;
          margin-bottom: 10px;
        }

        .issue-context code {
          font-size: 14px;
        }

        .issue-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          align-items: center;
        }

        .suggestions-label {
          font-size: 13px;
          color: #666;
        }

        .suggestion-btn {
          padding: 5px 10px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 13px;
        }

        .suggestion-btn:hover {
          background: #45a049;
        }

        .no-issues {
          text-align: center;
          padding: 40px;
          background: #e8f5e9;
          border-radius: 5px;
        }

        .success-icon {
          font-size: 48px;
          color: #4CAF50;
        }
      `}} />
    </div>
  );
};

export default GrammarChecker;
