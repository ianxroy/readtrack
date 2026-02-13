import React, { useState, useRef, useEffect } from 'react';
import type { JSX } from 'react';
import {
  StudentDiagnosisResult,
  TextComplexityResult,
  Language,
  ComplexityLevel,
  GrammarIssue,
  IssueCategory,
  ProficiencyLevel,
  LearningBand,
  PhilIriLevel,
  CachedAnalysis
} from '../types';
import { analyzeStudentWorkAPI, classifyTextComplexityAPI, extractTextFromImageAPI } from '../services/pythonService';
import { validateContentWithGemini } from '../services/geminiService';
import { checkGrammar, GrammarCheckResponse, GrammarIssue as GrammarServiceIssue, getDefinition, DefinitionResponse } from '../services/grammarService';

import {
  IoSparkles,
  IoCloseCircle,
  IoAttachOutline,
  IoSettingsOutline,
  IoSend,
  IoDocumentText,
  IoInformationCircleOutline,
  IoAlertCircle,
  IoCheckmarkCircle,
  IoTrashOutline,
  IoTrendingUpOutline,
  IoHelpCircleOutline,
  IoBookOutline,
  IoSaveOutline,
  IoStatsChartOutline,
  IoMenuOutline
} from "react-icons/io5";

const parseMarkdown = (text: string): (string | JSX.Element)[] => {
    const elements: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let key = 0;

    const markdownRegex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(__(.+?)__)|(_(.+?)_)/g;
    let match;

    while ((match = markdownRegex.exec(text)) !== null) {

        if (match.index > lastIndex) {
            elements.push(text.slice(lastIndex, match.index));
        }

        if (match[2]) {

            elements.push(<strong key={key++} className="font-bold">{match[2]}</strong>);
        } else if (match[4]) {

            elements.push(<strong key={key++} className="font-bold">{match[4]}</strong>);
        } else if (match[6]) {

            elements.push(<em key={key++} className="italic">{match[6]}</em>);
        } else if (match[8]) {

            elements.push(<em key={key++} className="italic">{match[8]}</em>);
        }

        lastIndex = markdownRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        elements.push(text.slice(lastIndex));
    }

    return elements.length > 0 ? elements : [text];
};

interface ActiveIssueState {
    issue: GrammarIssue;
    rect: DOMRect;
}

interface AnalyzerProps {
    initialReferenceFiles?: { base64: string; mimeType: string; name: string }[];
    referenceFileName?: string;
    onSaveReference?: (name: string, files: { base64: string; mimeType: string; name: string }[]) => void;
    onSaveAnalysis?: (analysis: CachedAnalysis) => void;
    selectedAnalysis?: CachedAnalysis | null;
    onMenuClick?: () => void;
}

const MetricRow = ({ label, value, info }: { label: string, value: string, info?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleClick = () => {
        if (info) {
            setIsOpen(!isOpen);
            if (!isOpen) {
                setIsLoading(true);
                setTimeout(() => setIsLoading(false), 300);
            }
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <div
                className={`flex justify-between items-center py-2 border-b border-gray-50 last:border-0 ${info ? 'cursor-pointer hover:bg-teal-50/40' : ''} transition-all duration-200 px-2 -mx-2 rounded-lg group`}
                onClick={handleClick}
            >
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">{label}</span>
                    {info && (
                        <div className="relative">
                            <IoHelpCircleOutline className={`text-gray-300 group-hover:text-teal-500 transition-all duration-200 ${isOpen ? 'text-teal-500 scale-110' : 'scale-100'}`} />
                            {isOpen && <div className="absolute inset-0 bg-teal-500/20 rounded-full animate-pulse"></div>}
                        </div>
                    )}
                </div>
                <span className="text-sm font-bold text-gray-800">{value}</span>
            </div>
            {isOpen && info && (
                <div className="absolute z-50 left-0 right-0 -bottom-2 translate-y-full">
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white text-[10px] p-3 rounded-xl shadow-2xl border border-gray-700 leading-tight animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-sm">
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span className="text-gray-300">Loading...</span>
                            </div>
                        ) : (
                            <>
                                <div className="mb-1 font-semibold text-teal-300">{label}</div>
                                <div className="text-gray-200">{info}</div>
                            </>
                        )}
                        <div className="absolute -top-2 left-4 w-3 h-3 bg-gray-800 rotate-45 border-t border-l border-gray-700"></div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ResultCard = ({ title, children, className = "", description }: { title?: string, children?: React.ReactNode, className?: string, description?: React.ReactNode }) => {
    const [showInfo, setShowInfo] = useState(false);

    return (
        <div className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm ${className} relative`}>
            {title && (
                <div className="flex items-center gap-2 mb-3 group cursor-pointer w-fit" onClick={() => description && setShowInfo(!showInfo)}>
                    <IoInformationCircleOutline className="text-gray-400 group-hover:text-teal-500 transition-colors" />
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide group-hover:text-teal-600 transition-colors">{title}</h3>
                </div>
            )}

            {showInfo && description && (
                <div className="mb-3 bg-teal-50 text-teal-800 text-[10px] p-2 rounded-lg border border-teal-100 animate-in fade-in slide-in-from-top-1 leading-relaxed">
                   {description}
                </div>
            )}

            {children}
        </div>
    );
};

const ComplexityMetricsCard = ({ result }: { result: TextComplexityResult }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
                 <IoStatsChartOutline className="text-gray-400 text-xs" />
                 <h4 className="text-[10px] text-gray-400 uppercase tracking-wider font-normal">Simulated Metrics</h4>
            </div>
            <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-xs font-medium">Fixation</span>
                    <span className="text-gray-900 font-bold text-xs">{result.fixationDuration}%</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-xs font-medium">Regression Index</span>
                    <span className="text-gray-900 font-bold text-xs">{result.regressionIndex}%</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-xs font-medium">Est. Reading Time</span>
                    <span className="text-gray-900 font-bold text-xs">{result.estimatedReadingTime} min</span>
                </div>
            </div>
        </div>

        <div>
            <div className="flex items-center gap-2 mb-2">
                 <IoStatsChartOutline className="text-gray-400 text-xs" />
                 <h4 className="text-[10px] text-gray-400 uppercase tracking-wider font-normal">Raw Status</h4>
            </div>
            <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-xs font-medium">Total Words</span>
                    <span className="text-gray-900 font-bold text-xs">{result.wordCount}</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-xs font-medium">Avg Sentence Len</span>
                    <span className="text-gray-900 font-bold text-xs">{result.avgSentenceLength} words</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-xs font-medium">Diff Word Ratio</span>
                    <span className="text-gray-900 font-bold text-xs">{result.difficultWordRatio}%</span>
                </div>
            </div>
        </div>
    </div>
);

const GrammarScoreCard = ({ grammarResult }: { grammarResult: GrammarCheckResponse | null }) => {
    if (!grammarResult) return null;

    const totalWords = grammarResult.text.split(/\s+/).filter(w => w.length > 0).length;

    const weightedErrors = grammarResult.issues.reduce((sum, issue) => {
        let weight = 1;

        const typeWeights: Record<string, number> = {
            'spelling': 2.0,
            'grammar': 1.5,
            'punctuation': 0.8,
            'style': 0.6,
            'capitalization': 0.4
        };

        const isCapitalizationIssue =
            issue.message?.toLowerCase().includes('capital') ||
            issue.message?.toLowerCase().includes('nakamalaking titik') ||
            issue.rule_id?.includes('CAPITALIZATION') ||
            issue.rule_id?.includes('PROPER_NOUN') ||
            issue.rule_id?.includes('NAME_AFTER');

        if (isCapitalizationIssue) {
            weight = 0.4;
        } else {
            weight = typeWeights[issue.type] || 1.0;
        }

        if (issue.severity === 'error') {
            weight *= 1.2;
        } else if (issue.severity === 'warning') {
            weight *= 0.8;
        } else {
            weight *= 0.5;
        }

        return sum + weight;
    }, 0);

    const errorRate = totalWords > 0 ? (weightedErrors / totalWords) * 100 : 0;
    const grammarScore = Math.max(0, Math.min(100, 100 - errorRate));

    const getScoreColor = (score: number) => {
        if (score >= 90) return { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' };
        if (score >= 75) return { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' };
        if (score >= 60) return { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' };
        return { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' };
    };

    const colors = getScoreColor(grammarScore);
    const errorCount = grammarResult.issues.filter(i => i.severity === 'error').length;
    const warningCount = grammarResult.issues.filter(i => i.severity === 'warning').length;

    return (
        <div className={`bg-white border ${colors.border} rounded-xl p-4 shadow-sm mb-3`}>
            <div className="flex items-center justify-between mb-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <IoStatsChartOutline className="text-gray-400 text-xs" />
                        <h4 className="text-[10px] text-gray-400 uppercase tracking-wider font-normal">Grammar Analysis</h4>
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                        <strong>Language:</strong> {grammarResult.detected_language === 'en' ? 'English' : 'Filipino'}
                    </div>
                </div>
                <div className={`${colors.bg} ${colors.text} px-3 py-2 rounded-lg`}>
                    <div className="text-[10px] font-bold uppercase">Score</div>
                    <div className="text-2xl font-bold">{Math.round(grammarScore)}</div>
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-xs font-medium">Total Issues</span>
                    <span className="text-gray-900 font-bold text-xs">{grammarResult.issue_count}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-xs font-medium flex items-center gap-1">
                        <span className="text-red-500">●</span> Errors
                    </span>
                    <span className="text-red-600 font-bold text-xs">{errorCount}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-xs font-medium flex items-center gap-1">
                        <span className="text-orange-500">●</span> Warnings
                    </span>
                    <span className="text-orange-600 font-bold text-xs">{warningCount}</span>
                </div>
            </div>

            {grammarResult.ai_overall_feedback && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-1 flex items-center gap-1">
                        <IoSparkles className="text-purple-500" /> AI Feedback
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{grammarResult.ai_overall_feedback}</p>
                </div>
            )}
        </div>
    );
};

const VerdictCard = ({ result, issueCount, detectedLanguage }: { result: StudentDiagnosisResult, issueCount: number, detectedLanguage?: string }) => {
    const isGood = result.proficiency === ProficiencyLevel.PROFICIENT || result.proficiency === ProficiencyLevel.ADVANCED;
    const [activeStat, setActiveStat] = useState<'score' | 'issues' | null>(null);

    const languageDisplay = detectedLanguage === 'tl' ? '🇵🇭 Filipino' :
                           detectedLanguage === 'en' ? '🇺🇸 English' :
                           detectedLanguage ? `${detectedLanguage.toUpperCase()}` : 'Unknown';

    return (
        <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-4 shadow-sm mb-3 relative overflow-visible">
            <div className={`absolute top-0 right-0 w-20 h-20 rounded-full -mr-8 -mt-8 opacity-20 pointer-events-none ${isGood ? 'bg-green-400' : 'bg-orange-400'}`}></div>

            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Overall Verdict</h3>
                    <div className="text-xl font-bold text-gray-800 tracking-tight">{result.proficiency}</div>
                    {detectedLanguage && (
                        <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                            <span className="font-medium">Language:</span>
                            <span className="font-semibold text-teal-600">{languageDisplay}</span>
                        </div>
                    )}
                </div>
                <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-lg
                    ${isGood ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}
                `}>
                    {isGood ? <IoCheckmarkCircle /> : <IoTrendingUpOutline />}
                </div>
            </div>

            <p className="text-xs text-gray-600 mb-4 leading-relaxed line-clamp-3">
                {result.feedback || "The text demonstrates a solid understanding of the topic, though there are areas for improvement in sentence structure."}
            </p>

            <div className="flex gap-2 relative">
                 <div
                    className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-center cursor-pointer hover:border-teal-200 hover:shadow-md transition-all group"
                    onClick={() => setActiveStat(activeStat === 'score' ? null : 'score')}
                 >
                    <div className="text-[10px] text-gray-400 uppercase font-bold group-hover:text-teal-500">NAT Score</div>
                    <div className="text-base font-bold text-teal-600">{result.natScore}</div>
                 </div>

                 <div
                    className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-center cursor-pointer hover:border-red-200 hover:shadow-md transition-all group"
                    onClick={() => setActiveStat(activeStat === 'issues' ? null : 'issues')}
                 >
                    <div className="text-[10px] text-gray-400 uppercase font-bold group-hover:text-red-500">Issues</div>
                    <div className="text-base font-bold text-red-500">{issueCount}</div>
                 </div>

                 {activeStat === 'score' && (
                     <div className="absolute top-full left-0 mt-2 w-full bg-gray-800 text-white text-[10px] p-2 rounded-lg z-20 animate-in fade-in slide-in-from-top-2">
                        <div className="absolute -top-1 left-1/4 w-2 h-2 bg-gray-800 rotate-45"></div>
                        <strong>NAT Est:</strong> Based on grammar, vocabulary, and structure.
                     </div>
                 )}
                 {activeStat === 'issues' && (
                     <div className="absolute top-full right-0 mt-2 w-full bg-gray-800 text-white text-[10px] p-2 rounded-lg z-20 animate-in fade-in slide-in-from-top-2">
                        <div className="absolute -top-1 right-1/4 w-2 h-2 bg-gray-800 rotate-45"></div>
                        <strong>Issues:</strong> Grammatical, clarity, and vocabulary suggestions.
                     </div>
                 )}
            </div>
        </div>
    );
};

const SuggestionPopover = ({
    active,
    onAccept,
    onDismiss
}: {
    active: ActiveIssueState | null,
    onAccept: () => void,
    onDismiss: () => void
}) => {
    if (!active) return null;

    const style: React.CSSProperties = {
        position: 'fixed',
        top: `${active.rect.bottom + 10}px`,
        left: `${active.rect.left}px`,
        zIndex: 100,
        maxWidth: '280px'
    };

    const categoryColors = {
        [IssueCategory.GRAMMAR]: 'border-l-4 border-l-red-500',
        [IssueCategory.CLARITY]: 'border-l-4 border-l-blue-500',
        [IssueCategory.VOCABULARY]: 'border-l-4 border-l-purple-500',
        [IssueCategory.STYLE]: 'border-l-4 border-l-orange-500',
    };

    return (
        <div style={style} className={`bg-white rounded-xl shadow-2xl border border-gray-100 p-3 animate-in fade-in zoom-in-95 duration-200 ${categoryColors[active.issue.category] || 'border-l-4 border-l-gray-500'}`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">{active.issue.category}</span>
                <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
                    <IoCloseCircle className="text-base" />
                </button>
            </div>

            <div className="mb-2">
                <div className="text-gray-400 line-through text-xs mb-0.5">{active.issue.original}</div>
                <div className="text-gray-900 font-bold text-base flex items-center gap-2 break-words">
                    <span className="break-words">{active.issue.suggestion}</span>
                    <IoSparkles className="text-teal-400 text-xs flex-shrink-0" />
                </div>
            </div>

            {active.issue.explanation && (
                <p className="text-[10px] text-gray-500 mb-3 bg-gray-50 p-2 rounded-lg border border-gray-100 leading-tight">
                    {active.issue.explanation}
                </p>
            )}

            <div className="flex gap-2">
                <button
                    onClick={onAccept}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                    Accept
                </button>
                <button
                    onClick={onDismiss}
                    className="w-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg transition-colors"
                >
                    <IoTrashOutline />
                </button>
            </div>
        </div>
    );
};

const InteractiveEditor = ({
    text,
    issues,
    grammarIssues,
    proficientWords,
    onIssueClick,
    detectedLanguage,
    geminiApiKey
}: {
    text: string,
    issues: GrammarIssue[],
    grammarIssues?: GrammarServiceIssue[],
    proficientWords?: string[],
    onIssueClick: (issue: GrammarIssue, e: React.MouseEvent) => void,
    detectedLanguage?: string,
    geminiApiKey?: string
}) => {
    const [defTooltip, setDefTooltip] = useState<{
        visible: boolean;
        word: string;
        data: DefinitionResponse | null;
        pos: { x: number, y: number };
        loading: boolean;
        placement: 'top' | 'bottom';
        grammarIssue?: GrammarServiceIssue;
    }>({ visible: false, word: '', data: null, pos: { x: 0, y: 0 }, loading: false, placement: 'top' });

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const getSentenceContext = (wordOffset: number): string => {
        const beforeText = text.slice(Math.max(0, wordOffset - 100), wordOffset);
        const afterText = text.slice(wordOffset, Math.min(text.length, wordOffset + 100));
        const fullContext = beforeText + afterText;

        const sentenceMatch = fullContext.match(/[.!?]\s*([^.!?]+)/);
        if (sentenceMatch) return sentenceMatch[1];

        return fullContext.trim();
    };

    const handleWordEnter = (word: string, e: React.MouseEvent, grammarIssue?: GrammarServiceIssue) => {
        const cleanWord = word.replace(/[^\w'-]/g, '').trim();
        if (cleanWord.length < 2) return;

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        const rect = e.currentTarget.getBoundingClientRect();
        const x = rect.left + rect.width / 2;

        const spaceAbove = rect.top;
        const placement = spaceAbove < 300 ? 'bottom' : 'top';
        const y = placement === 'top' ? rect.top : rect.bottom;

        setDefTooltip({
            visible: true,
            word: cleanWord,
            data: null,
            pos: { x, y },
            loading: true,
            placement,
            grammarIssue
        });

        timeoutRef.current = setTimeout(async () => {
             try {

                const wordIndex = text.toLowerCase().indexOf(cleanWord.toLowerCase());
                const context = wordIndex >= 0 ? getSentenceContext(wordIndex) : undefined;

                const lang = detectedLanguage === 'tl' ? 'tl' : 'en';
                console.log('🔍 Definition request:', { word: cleanWord, detectedLanguage, lang, hasApiKey: !!geminiApiKey, apiKeyLength: geminiApiKey?.length });
                const data = await getDefinition(cleanWord, lang, context, geminiApiKey);
                setDefTooltip(prev => prev.word === cleanWord ? { ...prev, data, loading: false } : prev);
            } catch (err) {
                console.error('Definition error:', err);
                setDefTooltip(prev => prev.word === cleanWord ? { ...prev, loading: false } : prev);
            }
        }, 500);
    };

    const handleWordLeave = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setDefTooltip(prev => ({ ...prev, visible: false }));
    };

    const grammarHighlights: { offset: number, length: number, issue: GrammarServiceIssue }[] = [];
    if (grammarIssues) {
        grammarIssues.forEach(issue => {
            grammarHighlights.push({
                offset: issue.offset,
                length: issue.length,
                issue: issue
            });
        });
    }

    grammarHighlights.sort((a, b) => a.offset - b.offset);

    const segments: { text: string, grammarIssue?: GrammarServiceIssue, diagIssue?: GrammarIssue }[] = [];
    let pos = 0;

    grammarHighlights.forEach(highlight => {
        if (highlight.offset > pos) {
            segments.push({ text: text.substring(pos, highlight.offset) });
        }
        segments.push({
            text: text.substring(highlight.offset, highlight.offset + highlight.length),
            grammarIssue: highlight.issue
        });
        pos = highlight.offset + highlight.length;
    });

    if (pos < text.length) {
        segments.push({ text: text.substring(pos) });
    }

    if (!grammarIssues || grammarIssues.length === 0) {
        segments.length = 0;
        const sortedIssues = [...issues].sort((a, b) => text.indexOf(a.original) - text.indexOf(b.original));
        let searchFrom = 0;

        sortedIssues.forEach(issue => {
            const index = text.indexOf(issue.original, searchFrom);
            if (index !== -1) {
                if (index > searchFrom) {
                    segments.push({ text: text.substring(searchFrom, index) });
                }
                segments.push({ text: issue.original, diagIssue: issue });
                searchFrom = index + issue.original.length;
            }
        });

        if (searchFrom < text.length) {
            segments.push({ text: text.substring(searchFrom) });
        }
    }

    const getGrammarStyle = (issue: GrammarServiceIssue) => {
        const isCaps = issue.message?.toLowerCase().includes('capital') ||
                       issue.message?.toLowerCase().includes('nakamalaking titik') ||
                       issue.rule_id?.includes('CAPITALIZATION') ||
                       issue.rule_id?.includes('PROPER_NOUN') ||
                       issue.rule_id?.includes('NAME_AFTER');

        const typeStyles: Record<string, string> = {
            'spelling': 'border-b-2 border-red-500 bg-red-100/80 hover:bg-red-200',
            'grammar': 'border-b-2 border-purple-500 bg-purple-100/80 hover:bg-purple-200',
            'punctuation': 'border-b-2 border-blue-500 bg-blue-100/80 hover:bg-blue-200',
            'style': 'border-b-2 border-indigo-500 bg-indigo-100/80 hover:bg-indigo-200',
        };

        if (isCaps) {
            return 'border-b-2 border-yellow-500 bg-yellow-100/80 hover:bg-yellow-200 cursor-pointer transition-all';
        }

        if (typeStyles[issue.type]) {
            return typeStyles[issue.type] + ' cursor-pointer transition-all';
        }

        switch(issue.severity) {
            case 'error':
                return "border-b-2 border-red-500 bg-red-100/80 hover:bg-red-200 cursor-pointer transition-all";
            case 'warning':
                return "border-b-2 border-orange-500 bg-orange-100/80 hover:bg-orange-200 cursor-pointer transition-all";
            case 'info':
                return "border-b-2 border-blue-500 bg-blue-100/80 hover:bg-blue-200 cursor-pointer transition-all";
            default:
                return "border-b-2 border-gray-500 bg-gray-100/80 hover:bg-gray-200 cursor-pointer transition-all";
        }
    };

    const getIssueStyle = (cat: IssueCategory) => {
        switch(cat) {
            case IssueCategory.GRAMMAR:
                return "border-b-2 border-red-400 bg-red-50 hover:bg-red-100 text-red-900";
            case IssueCategory.CLARITY:
                return "border-b-2 border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-900";
            case IssueCategory.VOCABULARY:
                return "border-b-2 border-purple-400 bg-purple-50 hover:bg-purple-100 text-purple-900";
            case IssueCategory.STYLE:
                return "border-b-2 border-orange-400 bg-orange-50 hover:bg-orange-100 text-orange-900";
            default:
                return "border-b-2 border-gray-400";
        }
    };

    const proficientSet = new Set((proficientWords || []).map(word => word.toLowerCase()));

    const renderWithProficientHighlight = (segmentText: string) => {
        const parts = segmentText.split(/(\b\w+\b)/g);
        return parts.map((part, idx) => {
            const lower = part.toLowerCase();
            const isWord = /[a-zA-Z]/.test(part);

            if (proficientSet.has(lower)) {
                return (
                    <span
                        key={`${lower}-${idx}`}
                        className="bg-emerald-100 text-emerald-800 border-b-2 border-emerald-500 px-0.5 rounded-sm cursor-help"
                        onMouseEnter={(e) => handleWordEnter(part, e)}
                        onMouseLeave={handleWordLeave}
                    >
                        {part}
                    </span>
                );
            }
            if (isWord) {
                 return (
                    <span
                        key={`${part}-${idx}`}
                        className="hover:bg-gray-100 cursor-text rounded-sm transition-colors"
                        onMouseEnter={(e) => handleWordEnter(part, e)}
                        onMouseLeave={handleWordLeave}
                    >
                        {part}
                    </span>
                );
            }
            return <span key={`${part}-${idx}`}>{part}</span>;
        });
    };

    return (
        <div className="font-serif text-base leading-loose text-gray-800 whitespace-pre-wrap">
            {segments.map((seg, i) => {
                if (seg.grammarIssue) {
                    return (
                        <span
                            key={i}
                            onMouseEnter={(e) => handleWordEnter(seg.text, e, seg.grammarIssue)}
                            onMouseLeave={handleWordLeave}
                            className={`cursor-pointer transition-all ${getGrammarStyle(seg.grammarIssue)}`}
                        >
                            {seg.text}
                        </span>
                    );
                }
                if (seg.diagIssue) {
                    return (
                        <span
                            key={i}
                            onClick={(e) => {
                                e.stopPropagation();
                                seg.diagIssue && onIssueClick(seg.diagIssue, e);
                            }}
                            className={`cursor-pointer transition-all px-0.5 rounded-sm pb-0.5 mx-0.5 ${getIssueStyle(seg.diagIssue.category)}`}
                        >
                            {seg.text}
                        </span>
                    );
                }
                return <span key={i}>{renderWithProficientHighlight(seg.text)}</span>;
            })}

            {defTooltip.visible && (
                <div
                    className="fixed z-50 bg-white text-gray-800 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 w-[320px] max-w-[90vw] pointer-events-auto animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
                    style={{
                        top: defTooltip.pos.y,
                        left: defTooltip.pos.x,
                        transform: defTooltip.placement === 'top'
                            ? 'translate(-50%, -100%) translateY(-15px)'
                            : 'translate(-50%, 15px)',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}
                >
                    {defTooltip.loading ? (
                         <div className="flex items-center gap-3 text-sm font-medium text-teal-600">
                             <div className="w-4 h-4 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
                             Finding word details...
                         </div>
                    ) : defTooltip.data ? (
                        <div className="space-y-4">
                             {}
                             {defTooltip.grammarIssue && (
                                 <div className="border-b border-gray-200 pb-3 mb-3">
                                     <div className="flex items-start gap-2">
                                         <span className="text-lg">
                                             {defTooltip.grammarIssue.type === 'spelling' ? '✏️' :
                                              defTooltip.grammarIssue.type === 'grammar' ? '📝' :
                                              defTooltip.grammarIssue.type === 'punctuation' ? '❗' :
                                              defTooltip.grammarIssue.type === 'style' ? '✨' : '⚠️'}
                                         </span>
                                         <div className="flex-1">
                                             <div className={`font-bold uppercase text-[9px] tracking-wider mb-1 ${
                                                 defTooltip.grammarIssue.type === 'spelling' ? 'text-red-600' :
                                                 defTooltip.grammarIssue.type === 'grammar' ? 'text-purple-600' :
                                                 defTooltip.grammarIssue.type === 'punctuation' ? 'text-blue-600' :
                                                 defTooltip.grammarIssue.type === 'style' ? 'text-indigo-600' :
                                                 'text-gray-600'
                                             }`}>
                                                 {defTooltip.grammarIssue.type} • <span className={`${
                                                     defTooltip.grammarIssue.severity === 'error' ? 'text-red-500' :
                                                     defTooltip.grammarIssue.severity === 'warning' ? 'text-orange-500' :
                                                     'text-blue-500'
                                                 }`}>{defTooltip.grammarIssue.severity}</span>
                                             </div>
                                             <div className="text-[12px] leading-relaxed text-gray-700 font-medium">{parseMarkdown(defTooltip.grammarIssue.message)}</div>
                                             {defTooltip.grammarIssue.replacements && defTooltip.grammarIssue.replacements.length > 0 && (
                                                 <div className="mt-2">
                                                     <div className="text-emerald-600 font-bold text-[9px] uppercase tracking-widest mb-1.5">💡 Suggestions</div>
                                                     <div className="flex flex-wrap gap-1.5">
                                                         {defTooltip.grammarIssue.replacements.map((rep, idx) => (
                                                             <span key={idx} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg text-[11px] font-semibold">
                                                                 {rep}
                                                             </span>
                                                         ))}
                                                     </div>
                                                 </div>
                                             )}
                                         </div>
                                     </div>
                                 </div>
                             )}

                             {}
                             <div className="flex items-start justify-between border-b border-gray-100 pb-3 gap-2">
                                 <div>
                                     <h3 className="font-bold text-xl text-gray-900 capitalize tracking-tight leading-tight">{defTooltip.data.word}</h3>
                                     {defTooltip.data.part_of_speech && (
                                         <span className="text-[11px] font-bold text-teal-600 uppercase tracking-widest mt-1 block">{defTooltip.data.part_of_speech}</span>
                                     )}
                                 </div>
                                 {defTooltip.data.cefr && detectedLanguage !== 'tl' && (
                                     <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase shadow-sm ${
                                         ['C1','C2'].includes(defTooltip.data.cefr) ? 'bg-emerald-500 text-white border-emerald-500' :
                                         ['B1','B2'].includes(defTooltip.data.cefr) ? 'bg-blue-500 text-white border-blue-500' :
                                         'bg-gray-100 text-gray-600 border-gray-200'
                                     }`}>
                                         {defTooltip.data.cefr}
                                     </span>
                                 )}
                             </div>

                             <div className="space-y-3">
                                {defTooltip.data.definitions.length > 0 ? (
                                    <div className="space-y-2">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block">Meaning</span>
                                        <ul className="space-y-2">
                                            {defTooltip.data.definitions.slice(0, 2).map((def, i) => (
                                                <li key={i} className="text-[13px] leading-relaxed text-gray-700 font-medium">
                                                    {parseMarkdown(def)}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">Definition not found.</p>
                                )}

                                {defTooltip.data.examples && defTooltip.data.examples.length > 0 && (
                                    <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-100/50">
                                        <span className="text-[10px] text-teal-600 font-bold uppercase tracking-widest block mb-1.5">Example</span>
                                        <p className="text-[12px] italic text-gray-700 leading-relaxed font-medium">
                                            "{parseMarkdown(defTooltip.data.examples[0])}"
                                        </p>
                                    </div>
                                )}
                             </div>

                             {defTooltip.data.synonyms.length > 0 && (
                                 <div className="pt-3 border-t border-gray-50">
                                     <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-2">Synonyms</span>
                                     <div className="flex flex-wrap gap-1.5">
                                         {defTooltip.data.synonyms.map((syn, i) => (
                                             <span key={i} className="text-[11px] bg-white text-gray-600 px-2 py-0.5 rounded-lg border border-gray-200 shadow-sm font-medium">
                                                 {parseMarkdown(syn)}
                                             </span>
                                         ))}
                                     </div>
                                 </div>
                             )}
                        </div>
                    ) : null}
                    <div className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-gray-100 transform rotate-45 shadow-sm ${
                        defTooltip.placement === 'top'
                            ? 'bottom-[-8px] border-b border-r'
                            : 'top-[-8px] border-t border-l'
                    }`}></div>
                </div>
            )}
        </div>
    );
};

export const Analyzer: React.FC<AnalyzerProps> = ({ initialReferenceFiles, referenceFileName, onSaveReference, onSaveAnalysis, selectedAnalysis, onMenuClick }) => {
  const [currentText, setCurrentText] = useState("");
  const [inputText, setInputText] = useState("");
    const [referenceText, setReferenceText] = useState("");
    const [currentReferenceName, setCurrentReferenceName] = useState(referenceFileName || "");
    const [referenceFiles, setReferenceFiles] = useState<{ base64: string; mimeType: string; name: string }[]>([]);
    const [referenceFile, setReferenceFile] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [showReferenceInput, setShowReferenceInput] = useState(false);
  const [useReferenceValidation, setUseReferenceValidation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [diagnosisResult, setDiagnosisResult] = useState<StudentDiagnosisResult | null>(null);
  const [complexityResult, setComplexityResult] = useState<TextComplexityResult | null>(null);
  const [currentIssues, setCurrentIssues] = useState<GrammarIssue[]>([]);
  const [grammarResult, setGrammarResult] = useState<GrammarCheckResponse | null>(null);
  const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

  const [selectedFile, setSelectedFile] = useState<{base64: string, mimeType: string, name: string} | null>(null);

  const [activeIssue, setActiveIssue] = useState<ActiveIssueState | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const referenceFileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasResults = !!diagnosisResult && !!complexityResult;

        useEffect(() => {

        }, [initialReferenceFiles]);

    useEffect(() => {
        if (referenceFileName) {
            setCurrentReferenceName(referenceFileName);
        }
    }, [referenceFileName]);

    useEffect(() => {
        if (!selectedAnalysis) return;

        setCurrentText(selectedAnalysis.studentText || "");
        setInputText("");
        setDiagnosisResult(selectedAnalysis.diagnosisResult || null);
        setComplexityResult(selectedAnalysis.complexityResult || null);
        setCurrentIssues(selectedAnalysis.diagnosisResult?.issues || []);
        setGrammarResult(null);

        if (selectedAnalysis.referenceUsed) {
            setReferenceText(selectedAnalysis.referenceUsed);
            setShowReferenceInput(true);
            setCurrentReferenceName("Cached Reference");
        }
    }, [selectedAnalysis]);

  const handleAnalyze = async () => {
    setErrorMessage(null);
    setActiveIssue(null);

    const textToAnalyze = inputText || currentText;

    if (!textToAnalyze.trim() && !selectedFile) {
        setErrorMessage("Please enter text or upload a document to analyze.");
        return;
    }
    if (!selectedFile && textToAnalyze.trim().length < 15) {
        setErrorMessage("Text is too short. Please provide at least 15 characters for analysis.");
        return;
    }

    if (isLoading) return;

    setIsLoading(true);

    const finalText = textToAnalyze;
    setCurrentText(finalText);
    setInputText("");

    try {

      const [diag, comp, grammar] = await Promise.all([
        analyzeStudentWorkAPI(finalText, selectedFile?.base64),
        classifyTextComplexityAPI(finalText, selectedFile?.base64),
        checkGrammar(finalText, geminiApiKey).catch(() => null)
      ]);

      if (diag.analyzed_text) {
        console.log("📄 Analyzed text from API:", diag.analyzed_text);
        setCurrentText(diag.analyzed_text);
      }

            if (useReferenceValidation && showReferenceInput) {
                const referenceFilesToUse = referenceFiles.length > 0 ? referenceFiles : undefined;
                if (referenceText.trim().length > 5 || referenceFilesToUse) {
                    const contentResult = await validateContentWithGemini(
                        diag.analyzed_text || finalText,
                        referenceText.trim().length > 5 ? referenceText : undefined,
                        referenceFilesToUse
                    );
                    diag.contentValidation = contentResult;
                }
            }

      setDiagnosisResult(diag);
      setComplexityResult(comp);
      setCurrentIssues(diag.issues);
      setGrammarResult(grammar);

            if (onSaveAnalysis) {
                const analyzedText = diag.analyzed_text || finalText;
                const firstLine = analyzedText.split("\n").find((line) => line.trim().length > 0) || "Untitled Analysis";
                const title = firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine;
                const cachedAnalysis: CachedAnalysis = {
                    id: Date.now().toString(),
                    timestamp: new Date(),
                    title,
                    studentText: analyzedText,
                    diagnosisResult: diag,
                    complexityResult: comp,
                    referenceUsed: referenceText.trim().length > 5 ? referenceText : undefined
                };
                onSaveAnalysis(cachedAnalysis);
            }
    } catch (e: any) {
      console.error(e);
      let msg = "An unexpected error occurred.";
      if (e.message?.includes("too short")) {
          msg = "The content is too short to analyze properly.";
      } else if (e.message) {
          msg = e.message;
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
      setSelectedFile(null);
    }
  };

  const [isSaveReferenceModalOpen, setIsSaveReferenceModalOpen] = useState(false);
  const [referenceWorkspaceName, setReferenceWorkspaceName] = useState("");

  const handleSaveClick = () => {
      if (referenceFiles.length === 0 || !onSaveReference) return;
      setReferenceWorkspaceName(referenceFileName || "Reference Workspace");
      setIsSaveReferenceModalOpen(true);
  };

  const handleConfirmSaveReference = () => {
      if (!onSaveReference) return;
      const name = referenceWorkspaceName.trim() || "Reference Workspace";
      onSaveReference(name, referenceFiles);
      setIsSaveReferenceModalOpen(false);
  };

  const handleIssueClick = (issue: GrammarIssue, e: React.MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      setActiveIssue({ issue, rect });
  };

  const handleAcceptSuggestion = () => {
      if (!activeIssue) return;
      const newText = currentText.replace(activeIssue.issue.original, activeIssue.issue.suggestion);
      setCurrentText(newText);
      setCurrentIssues(prev => prev.filter(i => i !== activeIssue.issue));
      setActiveIssue(null);
  };

  const handleDismissSuggestion = () => {
      if (!activeIssue) return;
      setCurrentIssues(prev => prev.filter(i => i !== activeIssue.issue));
      setActiveIssue(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAnalyze();
    }
  };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        setErrorMessage(null);
        const file = e.target.files?.[0];
        if (file) {
            processFileAsStudent(file);
        }
    };

    const handleReferenceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        setErrorMessage(null);
        const files = e.target.files;
        if (files && files.length > 0) {
            Array.from(files).forEach((file) => processFileAsReference(file));
        }
    };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputText(e.target.value);
      if (errorMessage) setErrorMessage(null);
  };

    const [isDragging, setIsDragging] = useState(false);
    const [isDropModalOpen, setIsDropModalOpen] = useState(false);
    const [dragOverTarget, setDragOverTarget] = useState<'student' | 'reference' | null>(null);

    const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

    const processFileAsStudent = (file: File) => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
            setErrorMessage("File size exceeds 10MB limit.");
            return;
        }
        if (file.type === 'text/plain') {
            const reader = new FileReader();
            reader.onload = (e) => setInputText(prev => prev + (e.target?.result as string));
            reader.readAsText(file);
        } else if (file.type.includes('image') || file.type.includes('pdf')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedFile({
                    base64: (reader.result as string).split(',')[1],
                    mimeType: file.type,
                    name: file.name
                });
            };
            reader.readAsDataURL(file);
        } else {
            setErrorMessage("Please upload a text file, image, or PDF.");
        }
    };

    const processFileAsReference = async (file: File) => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
            setErrorMessage("File size exceeds 10MB limit.");
            return;
        }
        setShowReferenceInput(true);
        setCurrentReferenceName(file.name);
        if (file.type === 'text/plain') {
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const base64 = (reader.result as string).split(',')[1];
                    setReferenceFiles(prev => [...prev, { base64, mimeType: file.type, name: file.name }]);
                    setReferenceText("");
                } catch (err: any) {
                    setErrorMessage(err?.message || 'Failed to ingest reference text.');
                }
            };
            reader.readAsDataURL(file);
        } else if (file.type.includes('image') || file.type.includes('pdf')) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const base64 = (reader.result as string).split(',')[1];
                    setReferenceFiles(prev => [...prev, { base64, mimeType: file.type, name: file.name }]);
                    setReferenceText("");
                } catch (err: any) {
                    setErrorMessage(err?.message || 'Failed to ingest reference file.');
                }
            };
            reader.readAsDataURL(file);
        } else {
            setErrorMessage("Please upload a text file, image, or PDF.");
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setIsDropModalOpen(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        setErrorMessage(null);
        setIsDropModalOpen(true);
    };

    const handleDropToStudent = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFileAsStudent(files[0]);
        }
        setIsDropModalOpen(false);
        setIsDragging(false);
        setDragOverTarget(null);
    };

    const handleDropToReference = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            for (const file of Array.from(files)) {
                await processFileAsReference(file);
            }
        }
        setIsDropModalOpen(false);
        setIsDragging(false);
        setDragOverTarget(null);
    };

  return (
    <div className="flex flex-col h-full bg-white relative">

      <SuggestionPopover
        active={activeIssue}
        onAccept={handleAcceptSuggestion}
        onDismiss={handleDismissSuggestion}
      />

            {isSaveReferenceModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 w-[360px]">
                        <h3 className="text-sm font-semibold text-gray-800 mb-1">Name this reference workspace</h3>
                        <p className="text-xs text-gray-500 mb-3">You can reuse this later to verify new student files.</p>
                        <input
                            value={referenceWorkspaceName}
                            onChange={(e) => setReferenceWorkspaceName(e.target.value)}
                            placeholder="Reference Workspace"
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:ring-2 focus:ring-teal-100 focus:border-teal-300 outline-none"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsSaveReferenceModalOpen(false)}
                                className="flex-1 px-3 py-2 rounded-lg text-xs text-gray-600 hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmSaveReference}
                                className="flex-1 px-3 py-2 rounded-lg bg-teal-500 text-white text-xs font-semibold hover:bg-teal-600"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isDropModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-[640px] max-w-[90vw]">
                        <h3 className="text-base font-semibold text-gray-800 mb-1">Drop the file into a target</h3>
                        <p className="text-xs text-gray-500 mb-4">Drag into one of the boxes to assign the file.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOverTarget('student');
                                }}
                                onDragLeave={() => setDragOverTarget(null)}
                                onDrop={handleDropToStudent}
                                className={`h-40 rounded-xl border-2 border-dashed flex items-center justify-center text-sm font-semibold text-center transition-all ${
                                    dragOverTarget === 'student'
                                        ? 'border-teal-500 bg-teal-100 text-teal-800 shadow-lg'
                                        : 'border-teal-300 bg-teal-50 text-teal-700'
                                }`}
                            >
                                Student Output
                            </div>
                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOverTarget('reference');
                                }}
                                onDragLeave={() => setDragOverTarget(null)}
                                onDrop={handleDropToReference}
                                className={`h-40 rounded-xl border-2 border-dashed flex items-center justify-center text-sm font-semibold text-center transition-all ${
                                    dragOverTarget === 'reference'
                                        ? 'border-blue-500 bg-blue-100 text-blue-800 shadow-lg'
                                        : 'border-gray-300 bg-gray-50 text-gray-700'
                                }`}
                            >
                                Reference Material
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setIsDropModalOpen(false);
                                setIsDragging(false);
                                setDragOverTarget(null);
                            }}
                            className="mt-4 w-full px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-700"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

      <header className="h-14 flex items-center justify-between px-6 border-b border-gray-100 bg-white sticky top-0 z-20 shadow-sm">
         <div className="flex items-center gap-2">
             {onMenuClick && (
                 <button onClick={onMenuClick} className="md:hidden text-gray-500 hover:text-gray-700 active:scale-95 transition-transform">
                     <IoMenuOutline className="text-2xl" />
                 </button>
             )}
             <h1 className="text-lg font-bold text-teal-500 tracking-tight">ReadTrack</h1>
         </div>
         <button className="text-gray-400 hover:text-gray-600">
            <IoSettingsOutline className="text-lg" />
         </button>
      </header>

      <div
        className="flex-1 overflow-y-auto overflow-x-visible"
        ref={scrollRef}
        onClick={() => setActiveIssue(null)}
        style={{ position: 'relative' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >

         {!hasResults && !isLoading && !currentText && (
            <div className={`flex flex-col items-center justify-center h-[calc(100vh-200px)] animate-in fade-in zoom-in-95 duration-500 transition-all ${isDragging ? 'scale-105' : ''}`}>
                <div className={`w-20 h-20 bg-teal-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm transition-all ${isDragging ? 'bg-teal-100 scale-110 shadow-lg' : ''}`}>
                    <IoDocumentText className={`text-4xl text-teal-400 transition-all ${isDragging ? 'text-teal-600' : ''}`} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-3">{isDragging ? 'Drop File Here' : 'Ready to Analyze?'}</h2>
                <p className="text-gray-400 max-w-md text-center leading-relaxed">
                    {isDragging ? 'Release to upload your document' : 'Upload a document or paste text to get instant readability insights using our Hybrid SVM-AI model.'}
                </p>
            </div>
         )}

         {isLoading && (
             <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                 <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin mb-4"></div>
                 <p className="text-teal-600 font-medium animate-pulse text-sm">Running Python SVM & Gemini Validator...</p>
             </div>
         )}

         {hasResults && !isLoading && (
             <div className="flex flex-col lg:flex-row gap-4 p-4 pb-48 max-w-[1800px] mx-auto h-full min-h-full">

                 <div className="flex-1 bg-white rounded-xl relative border border-gray-100 shadow-sm flex flex-col min-h-[400px]" style={{ overflow: 'visible' }}>
                     <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 py-2 px-4 border-b border-gray-100 mb-4 flex gap-3 text-[10px] font-semibold text-gray-500 rounded-t-xl uppercase tracking-wider flex-wrap">
                         <div className="flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                             <span>Spelling</span>
                         </div>
                         <div className="flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                             <span>Grammar</span>
                         </div>
                         <div className="flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                             <span>Caps</span>
                         </div>
                         <div className="flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                             <span>Punct</span>
                         </div>
                         <div className="flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                             <span>Style</span>
                         </div>
                     </div>

                     <div className="prose max-w-none px-6 pb-6 flex-1 overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{maxHeight: 'calc(100vh - 250px)'}}>
                         <InteractiveEditor
                             text={currentText}
                             issues={currentIssues}
                             grammarIssues={grammarResult?.issues}
                             proficientWords={diagnosisResult?.metrics?.cefrWordGroups?.proficient}
                             onIssueClick={handleIssueClick}
                             detectedLanguage={grammarResult?.detected_language}
                             geminiApiKey={geminiApiKey}
                         />
                     </div>
                 </div>

                 <div className="w-full lg:w-[360px] shrink-0 space-y-3">

                     {diagnosisResult && (
                        <VerdictCard result={diagnosisResult} issueCount={currentIssues.length} detectedLanguage={grammarResult?.detected_language} />
                     )}

                     {diagnosisResult?.contentValidation?.hasReference && (
                        <ResultCard
                            title="Content Accuracy"
                            description="Semantic validation against teacher's reference material."
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <IoCheckmarkCircle className={`text-lg ${diagnosisResult.contentValidation.accuracyScore > 70 ? 'text-green-500' : diagnosisResult.contentValidation.accuracyScore > 50 ? 'text-orange-500' : 'text-red-500'}`} />
                                        <h4 className="text-xs text-gray-600 font-medium">Match Score</h4>
                                    </div>
                                </div>
                                <div className={`px-3 py-2 rounded-lg font-bold text-sm ${
                                    diagnosisResult.contentValidation.accuracyScore > 70
                                        ? 'bg-green-100 text-green-700'
                                        : diagnosisResult.contentValidation.accuracyScore > 50
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-red-100 text-red-700'
                                }`}>
                                    {diagnosisResult.contentValidation.accuracyScore > 70 ? '✓ Correct' : diagnosisResult.contentValidation.accuracyScore > 50 ? '~ Partial' : '✗ Needs Work'}
                                </div>
                            </div>

                            <div className="mb-3 text-center">
                                <div className={`text-3xl font-bold ${
                                    diagnosisResult.contentValidation.accuracyScore > 75 ? 'text-green-600' :
                                    diagnosisResult.contentValidation.accuracyScore > 50 ? 'text-orange-500' : 'text-red-500'
                                }`}>
                                    {diagnosisResult.contentValidation.accuracyScore}%
                                </div>
                            </div>

                            {diagnosisResult.contentValidation.missingPoints.length > 0 && (
                                <div className="mb-2">
                                    <h4 className="text-[10px] font-bold text-red-400 uppercase mb-1">Missing Concepts</h4>
                                    <ul className="text-xs text-gray-600 space-y-0.5 list-disc pl-3">
                                        {diagnosisResult.contentValidation.missingPoints.slice(0, 3).map((point, i) => (
                                            <li key={i}>{point}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                             {diagnosisResult.contentValidation.misconceptions.length > 0 && (
                                <div className="mb-2">
                                    <h4 className="text-[10px] font-bold text-orange-400 uppercase mb-1">Possible Misconceptions</h4>
                                    <ul className="text-xs text-gray-600 space-y-0.5 list-disc pl-3">
                                        {diagnosisResult.contentValidation.misconceptions.slice(0, 2).map((point, i) => (
                                            <li key={i}>{point}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="bg-teal-50 p-2 rounded-lg text-xs text-teal-800 italic border border-teal-100 mt-2">
                                <IoSparkles className="inline mr-1 text-teal-500"/>
                                "{diagnosisResult.contentValidation.suggestion}"
                            </div>
                        </ResultCard>
                     )}

                     <ResultCard
                        title="Readability"
                        description={
                            <div className="space-y-1">
                                <p>SVM-based complexity analysis aligned with Grade 7 Cognitive Depth Baselines (NLCA/Phil-IRI):</p>
                                <ul className="list-disc pl-3 space-y-1 text-teal-800/90 text-[10px] leading-relaxed">
                                    <li><strong>Literal Comprehension:</strong> Understanding a text’s stated facts, ideas, vocabulary, events, and information. It targets questions like “what,” “where,” “when,” and “who.”</li>
                                    <li><strong>Inferential Comprehension:</strong> Making valid inferences from the text—reading between the lines. It answers “why” and “how” questions through implied meaning (e.g., generalizations, comparisons, conclusions, assumptions, predictions, cause-and-effect).</li>
                                    <li><strong>Evaluative Comprehension:</strong> Deeper analysis of the author’s intent, opinion, language, and style. It evaluates the appropriateness of devices and makes judgments based on implied ideas.</li>
                                </ul>
                            </div>
                        }
                     >
                         <div className={`
                            py-3 rounded-lg text-center font-bold text-lg mb-1
                            ${complexityResult?.level === ComplexityLevel.EVALUATIVE ? 'bg-red-50 text-red-700' :
                              complexityResult?.level === ComplexityLevel.INFERENTIAL ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}
                         `}>
                            {complexityResult?.level === ComplexityLevel.EVALUATIVE ? 'Difficult' : complexityResult?.level}
                         </div>
                     </ResultCard>

                     {complexityResult && (
                         <ComplexityMetricsCard result={complexityResult} />
                     )}

                     {grammarResult && (
                         <GrammarScoreCard grammarResult={grammarResult} />
                     )}

                     {diagnosisResult?.metrics?.cefrWordGroups && grammarResult?.detected_language !== 'tl' && (
                        <ResultCard title="CEFR Vocabulary" description="Basic, Independent, and Proficient words (English). Proficient words are highlighted in the text.">
                            <div className="space-y-2">
                                <div>
                                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Basic (A1–A2)</div>
                                    <div className="flex flex-wrap gap-1">
                                        {diagnosisResult.metrics.cefrWordGroups.basic.slice(0, 12).map((w, i) => (
                                            <span key={`basic-${i}`} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px]">
                                                {w}
                                            </span>
                                        ))}
                                        {diagnosisResult.metrics.cefrWordGroups.basic.length === 0 && (
                                            <span className="text-[10px] text-gray-400">No basic words detected</span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Independent (B1–B2)</div>
                                    <div className="flex flex-wrap gap-1">
                                        {diagnosisResult.metrics.cefrWordGroups.independent.slice(0, 12).map((w, i) => (
                                            <span key={`ind-${i}`} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px]">
                                                {w}
                                            </span>
                                        ))}
                                        {diagnosisResult.metrics.cefrWordGroups.independent.length === 0 && (
                                            <span className="text-[10px] text-gray-400">No independent words detected</span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Proficient (C1–C2)</div>
                                    <div className="flex flex-wrap gap-1">
                                        {diagnosisResult.metrics.cefrWordGroups.proficient.slice(0, 12).map((w, i) => (
                                            <span key={`prof-${i}`} className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                                                {w}
                                            </span>
                                        ))}
                                        {diagnosisResult.metrics.cefrWordGroups.proficient.length === 0 && (
                                            <span className="text-[10px] text-gray-400">No proficient words detected</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </ResultCard>
                     )}

                     <ResultCard title="Proficiency Metrics" description="Metrics extracted for the Student Diagnosis (Proficiency) SVM model.">
                        <MetricRow
                            label="TTR (Vocab Richness)"
                            value={`${diagnosisResult?.metrics.vocabularyRichness}%`}
                            info="Type-Token Ratio: A higher percentage indicates a more diverse vocabulary."
                        />
                         <MetricRow
                            label="Structure Cohesion"
                            value={`${diagnosisResult?.metrics.structureCohesion}%`}
                            info="Measures the variance in sentence length. Consistent variance often indicates better flow."
                        />
                     </ResultCard>

                 </div>
             </div>
         )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent pointer-events-none flex justify-center z-50">
          <div className="pointer-events-auto w-full max-w-3xl relative flex flex-col items-center">

              {errorMessage && (
                  <div className="absolute -top-14 left-0 right-0 flex justify-center z-10 animate-in slide-in-from-bottom-2 fade-in duration-300">
                      <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-medium shadow-sm border border-red-100 flex items-center gap-2 backdrop-blur-sm">
                          <IoAlertCircle className="text-lg shrink-0" />
                          <span>{errorMessage}</span>
                          <button onClick={() => setErrorMessage(null)} className="ml-2 hover:bg-red-100 p-0.5 rounded-full transition-colors">
                            <IoCloseCircle className="text-base opacity-60 hover:opacity-100" />
                          </button>
                      </div>
                  </div>
              )}

              {showReferenceInput && (
                  <div className="w-full bg-white/90 backdrop-blur-xl border border-teal-200 rounded-xl p-3 shadow-xl mb-3 animate-in slide-in-from-bottom-2">
                       <div className="flex justify-between items-center mb-2 px-1">
                           <div className="flex items-center gap-2">
                               <label className="flex items-center gap-1.5 cursor-pointer">
                                   <input
                                       type="checkbox"
                                       checked={useReferenceValidation}
                                       onChange={(e) => setUseReferenceValidation(e.target.checked)}
                                       className="w-3.5 h-3.5 text-teal-600 rounded focus:ring-teal-500"
                                   />
                                   <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider flex items-center gap-1">
                                       <IoBookOutline /> Use Reference
                                   </span>
                               </label>
                           </div>
                           <div className="flex items-center gap-2">
                                                             <input
                                                                 type="file"
                                                                 ref={referenceFileInputRef}
                                                                 className="hidden"
                                                                 onChange={handleReferenceFileSelect}
                                                                 accept=".txt,image/*,.pdf"
                                                                 multiple
                                                             />
                               {initialReferenceFiles && initialReferenceFiles.length > 0 && (
                                   <button
                                       onClick={() => {
                                           setReferenceFiles(initialReferenceFiles);
                                           setCurrentReferenceName(referenceFileName || "Workspace Reference");
                                           setUseReferenceValidation(true);
                                       }}
                                       title="Load Workspace Reference"
                                       className="text-gray-400 hover:text-teal-600 transition-colors text-[10px] px-2 py-1 rounded bg-gray-50 hover:bg-teal-50"
                                   >
                                       Load Workspace
                                   </button>
                               )}
                               <button
                                onClick={() => referenceFileInputRef.current?.click()}
                                title="Upload Reference File"
                                className="text-gray-400 hover:text-teal-600 transition-colors"
                               >
                                   <IoAttachOutline className="text-base rotate-45"/>
                               </button>
                               <button
                                onClick={handleSaveClick}
                                title="Save to References"
                                className="text-gray-400 hover:text-teal-600 transition-colors"
                               >
                                   <IoSaveOutline className="text-base"/>
                               </button>
                               <button onClick={() => {
                                   setShowReferenceInput(false);
                                   setReferenceText("");
                                   setReferenceFiles([]);
                                   setCurrentReferenceName("");
                                   setUseReferenceValidation(false);
                               }} className="text-gray-400 hover:text-red-500" title="Close and clear reference">
                                   <IoCloseCircle className="text-base" />
                               </button>
                           </div>
                       </div>

                       <textarea
                           value={referenceText}
                           onChange={(e) => setReferenceText(e.target.value)}
                           placeholder="Enter reference text or answer key (optional)..."
                           className="w-full border border-gray-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none resize-none mb-2"
                           rows={3}
                       />

                       {currentReferenceName && (
                           <div className="mb-2 px-1 text-[10px] text-teal-600 font-medium">
                               Loaded: {currentReferenceName}
                           </div>
                       )}
                       {referenceFiles.length > 0 && (
                           <div className="mb-2 px-1 text-[10px] text-gray-500 space-y-1">
                               <div>{referenceFiles.length} file(s) attached</div>
                               <ul className="list-disc pl-4">
                                   {referenceFiles.map((f, i) => (
                                       <li key={`${f.name}-${i}`} className="truncate">{f.name}</li>
                                   ))}
                               </ul>
                           </div>
                       )}

                       {!useReferenceValidation && (
                           <div className="px-1 text-[10px] text-orange-500 italic bg-orange-50 rounded p-2 mt-1">
                               ⚠️ Reference validation disabled. Check "Use Reference" to validate content accuracy.
                           </div>
                       )}
                       {useReferenceValidation && !referenceText && referenceFiles.length === 0 && (
                           <div className="px-1 text-[10px] text-gray-400 italic">
                               Add reference text or upload files to validate content accuracy
                           </div>
                       )}

                  </div>
              )}

              {selectedFile && (
                  <div className="absolute -top-10 left-0 bg-teal-50 text-teal-700 px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-2 shadow-sm border border-teal-100">
                      <span>{selectedFile.name}</span>
                      <button onClick={() => setSelectedFile(null)} className="hover:text-red-500"><IoCloseCircle /></button>
                  </div>
              )}

              <div
                  className={`
                  w-full
                  bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] border transition-all flex items-center p-1.5 pr-1.5 relative group
                  ${errorMessage ? 'border-red-200 ring-2 ring-red-50' : 'border-gray-200'}
                  ${isDragging ? 'ring-2 ring-teal-400 border-teal-400 bg-teal-50' : ''}
              `}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
              >
                  <input
                    type="file" ref={fileInputRef} className="hidden"
                    onChange={handleFileSelect}
                    accept=".txt,image/*,.pdf"
                  />

                  <textarea
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={isDragging ? "Drop file here..." : "Type or paste text..."}
                                        className="flex-1 bg-transparent border-none focus:ring-0 outline-none focus:outline-none text-gray-700 ml-4 placeholder-gray-400 py-2 resize-none h-[40px] leading-[20px] text-sm"
                  />

                  <div className="flex items-center gap-1 pr-1">
                      <button
                        onClick={() => setShowReferenceInput(!showReferenceInput)}
                        title="Add Reference Material"
                        className={`p-2 transition-colors rounded-full ${showReferenceInput ? 'bg-teal-50 text-teal-600' : 'text-gray-400 hover:text-teal-600 hover:bg-gray-100'}`}
                      >
                          <IoBookOutline className="text-lg" />
                      </button>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-400 hover:text-teal-600 transition-colors rounded-full hover:bg-gray-100"
                      >
                          <IoAttachOutline className="text-lg rotate-45" />
                      </button>
                      <button
                        onClick={handleAnalyze}
                        disabled={(!inputText.trim() && !selectedFile) || isLoading}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                            (inputText.trim() || selectedFile) && !isLoading
                            ? 'bg-teal-500 text-white shadow-md hover:bg-teal-600'
                            : 'bg-gray-100 text-gray-300'
                        }`}
                      >
                         {isLoading ? (
                             <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                         ) : (
                             <IoSend className="ml-0.5 text-sm" />
                         )}
                      </button>
                  </div>
              </div>
          </div>
      </div>

    </div>
  );
};
