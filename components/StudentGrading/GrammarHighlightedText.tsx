import React, { useState, useMemo } from 'react';
import { GrammarIssue, IssueCategory } from '../../types';

interface GrammarHighlightedTextProps {
  text: string;
  issues: GrammarIssue[];
}

type Segment = { text: string; issue?: GrammarIssue };

const HIGHLIGHT: Record<string, { bg: string; text: string }> = {
  [IssueCategory.GRAMMAR]:    { bg: 'bg-red-100',    text: 'text-red-800' },
  [IssueCategory.STYLE]:      { bg: 'bg-amber-100',  text: 'text-amber-800' },
  [IssueCategory.VOCABULARY]: { bg: 'bg-blue-100',   text: 'text-blue-800' },
  [IssueCategory.CLARITY]:    { bg: 'bg-violet-100', text: 'text-violet-800' },
};
const BADGE: Record<string, { bg: string; text: string }> = {
  [IssueCategory.GRAMMAR]:    { bg: 'bg-red-900',    text: 'text-red-300' },
  [IssueCategory.STYLE]:      { bg: 'bg-amber-900',  text: 'text-amber-300' },
  [IssueCategory.VOCABULARY]: { bg: 'bg-blue-900',   text: 'text-blue-300' },
  [IssueCategory.CLARITY]:    { bg: 'bg-violet-900', text: 'text-violet-300' },
};
const FALLBACK_HIGHLIGHT = { bg: 'bg-slate-100', text: 'text-slate-600' };
const FALLBACK_BADGE     = { bg: 'bg-slate-700', text: 'text-slate-300' };

function charOverlap(a: string, b: string): number {
  const freq: Record<string, number> = {};
  for (const c of a) freq[c] = (freq[c] ?? 0) + 1;
  let count = 0;
  const used: Record<string, number> = {};
  for (const c of b) {
    used[c] = (used[c] ?? 0) + 1;
    if ((used[c]) <= (freq[c] ?? 0)) count++;
  }
  return count;
}

function findAllOccurrences(haystack: string, needle: string): number[] {
  const indices: number[] = [];
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    indices.push(idx);
    idx = haystack.indexOf(needle, idx + 1);
  }
  return indices;
}

function segmentText(text: string, issues: GrammarIssue[]): Segment[] {
  if (!text || !issues.length) return [{ text }];

  const candidates: Array<{ issue: GrammarIssue; startIndex: number }> = [];

  for (const issue of issues) {
    if (!issue.original) continue;

    let positions = findAllOccurrences(text, issue.original);
    if (!positions.length) {
      const lowerText = text.toLowerCase();
      const lowerNeedle = issue.original.toLowerCase();
      positions = findAllOccurrences(lowerText, lowerNeedle).filter(p =>
        text.slice(p, p + issue.original.length).toLowerCase() === lowerNeedle
      );
    }
    if (!positions.length) continue;

    let best = positions[0];
    let bestScore = -1;
    for (const pos of positions) {
      const contextWindow = text.slice(Math.max(0, pos - 20), pos + issue.original.length + 20);
      const score = charOverlap(contextWindow, issue.context);
      if (score > bestScore) { bestScore = score; best = pos; }
    }
    candidates.push({ issue, startIndex: best });
  }

  candidates.sort((a, b) => a.startIndex - b.startIndex);

  const segments: Segment[] = [];
  let cursor = 0;
  const matched: Array<[number, number]> = [];

  for (const { issue, startIndex } of candidates) {
    const end = startIndex + issue.original.length;
    const overlaps = matched.some(([s, e]) => startIndex < e && end > s);
    if (overlaps) continue;

    if (cursor < startIndex) segments.push({ text: text.slice(cursor, startIndex) });
    segments.push({ text: text.slice(startIndex, end), issue });
    matched.push([startIndex, end]);
    cursor = end;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

export const GrammarHighlightedText: React.FC<GrammarHighlightedTextProps> = ({ text, issues }) => {
  const [tooltipIssue, setTooltipIssue] = useState<GrammarIssue | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; above: boolean }>({
    top: 0, left: 0, above: true,
  });

  const segments = useMemo(() => segmentText(text, issues), [text, issues]);

  const handleEnter = (e: React.MouseEvent<HTMLSpanElement>, issue: GrammarIssue) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const above = rect.top > 80;
    setTooltipPos({ top: above ? rect.top - 8 : rect.bottom + 8, left: rect.left + rect.width / 2, above });
    setTooltipIssue(issue);
  };

  return (
    <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap relative">
      {segments.map((seg, i) => {
        if (!seg.issue) return <React.Fragment key={i}>{seg.text}</React.Fragment>;
        const h = HIGHLIGHT[seg.issue.category] ?? FALLBACK_HIGHLIGHT;
        return (
          <span
            key={i}
            className={`rounded px-0.5 cursor-pointer ${h.bg} ${h.text}`}
            onMouseEnter={(e) => handleEnter(e, seg.issue!)}
            onMouseLeave={() => setTooltipIssue(null)}
          >
            {seg.text}
          </span>
        );
      })}

      {tooltipIssue && (() => {
        const b = BADGE[tooltipIssue.category] ?? FALLBACK_BADGE;
        const style: React.CSSProperties = {
          position: 'fixed',
          left: tooltipPos.left,
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: 240,
          ...(tooltipPos.above
            ? { bottom: window.innerHeight - tooltipPos.top }
            : { top: tooltipPos.top }),
        };
        return (
          <div
            style={style}
            className="bg-[#1e293b] rounded-xl px-3 py-2.5 shadow-2xl pointer-events-none"
          >
            <span className={`inline-block text-[9px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 mb-2 ${b.bg} ${b.text}`}>
              {tooltipIssue.category}
            </span>
            <div className="text-[11px] text-slate-100 mb-1">
              <span className="line-through text-slate-400">{tooltipIssue.original}</span>
              <span className="text-slate-500 mx-1">→</span>
              <span className="text-green-400 font-semibold">{tooltipIssue.suggestion}</span>
            </div>
            {tooltipIssue.explanation && (
              <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-700 pt-1.5 mt-1">
                {tooltipIssue.explanation}
              </p>
            )}
            {/* Arrow */}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={tooltipPos.above
                ? { top: '100%', borderTop: '6px solid #1e293b', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', width: 0, height: 0 }
                : { bottom: '100%', borderBottom: '6px solid #1e293b', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', width: 0, height: 0 }
              }
            />
          </div>
        );
      })()}
    </div>
  );
};
