import React, { useState, useEffect } from 'react';
import { IoArrowBackOutline } from 'react-icons/io5';
import { getModelPerformanceAPI, ModelPerformanceData, DimensionMetrics } from '../../services/pythonService';

interface Props {
    onBack: () => void;
}

const DIM_LABELS: Record<string, string> = {
    content:       'Nilalaman',
    organization:  'Organisasyon',
    languageVocab: 'Wika/Bokab.',
    grammar:       'Gramatika',
    mechanics:     'Mekaniks',
};

const DIMS = ['content', 'organization', 'languageVocab', 'grammar', 'mechanics'];

function f1Color(f1: number): string {
    if (f1 >= 0.8) return 'text-teal-600';
    if (f1 >= 0.6) return 'text-amber-600';
    return 'text-red-600';
}

function maeColor(mae: number): string {
    if (mae <= 0.4) return 'bg-teal-400';
    if (mae <= 0.7) return 'bg-amber-400';
    return 'bg-red-400';
}

function macroCardColor(f1: number): string {
    if (f1 >= 0.8) return 'border-teal-200 bg-teal-50';
    if (f1 >= 0.6) return 'border-amber-200 bg-amber-50';
    return 'border-red-200 bg-red-50';
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return iso;
    }
}

function SkeletonLoader() {
    return (
        <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl" />
            ))}
        </div>
    );
}

export function ModelPerformancePage({ onBack }: Props) {
    const [lang, setLang] = useState<'en' | 'tl'>('en');
    const [data, setData] = useState<ModelPerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        getModelPerformanceAPI(lang)
            .then(d => {
                setData(d);
                setError(d.error ?? null);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [lang]);

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <header className="h-14 flex items-center justify-between px-5 border-b border-gray-100 bg-white shadow-sm flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="text-gray-500 hover:text-gray-800 transition-colors">
                        <IoArrowBackOutline className="text-xl" />
                    </button>
                    <span className="text-sm font-black text-gray-900 uppercase tracking-wide">
                        Katumpakan ng Modelo
                    </span>
                </div>
                {/* Language toggle */}
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs font-bold">
                    <button
                        onClick={() => setLang('en')}
                        className={`px-3 py-1 rounded-md transition-colors ${lang === 'en' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        🇺🇸 English
                    </button>
                    <button
                        onClick={() => setLang('tl')}
                        className={`px-3 py-1 rounded-md transition-colors ${lang === 'tl' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        🇵🇭 Filipino
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {loading && <SkeletonLoader />}

                {!loading && error && (
                    <div className="text-center text-red-500 text-sm py-8">{error}</div>
                )}

                {!loading && !error && data?.insufficient_data && (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                        <div className="text-4xl">📊</div>
                        <p className="text-gray-700 font-semibold text-sm max-w-xs">
                            Hindi pa sapat ang datos para makalkula ang katumpakan. Kailangan ng hindi bababa sa 5 na na-rate na essay.
                        </p>
                        <p className="text-gray-400 text-xs">
                            Na-rate na: <span className="font-bold">{data.rated_essays}</span> / 5
                        </p>
                    </div>
                )}

                {!loading && !error && data && !data.insufficient_data && (
                    <>
                        {/* Status bar */}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
                                {data.confidence_level}
                            </span>
                            <span>{data.rated_essays} na na-rate</span>
                            <span>·</span>
                            <span>Huling retrain: {formatDate(data.last_retrain)}</span>
                        </div>

                        {/* Summary metric cards */}
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                { label: 'Macro F1', value: data.macro_f1, color: macroCardColor(data.macro_f1), valueColor: f1Color(data.macro_f1) },
                                { label: 'Precision', value: data.macro_precision, color: 'border-gray-200 bg-white', valueColor: 'text-gray-800' },
                                { label: 'Recall', value: data.macro_recall, color: 'border-gray-200 bg-white', valueColor: 'text-gray-800' },
                                { label: 'Mga Ikinumpara', value: data.total_compared, color: 'border-gray-200 bg-white', valueColor: 'text-gray-800', isInt: true },
                            ].map(({ label, value, color, valueColor, isInt }) => (
                                <div key={label} className={`border rounded-xl p-3 text-center ${color}`}>
                                    <div className={`text-2xl font-black ${valueColor}`}>
                                        {isInt ? value : (value as number).toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mt-0.5">{label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Per-class F1 bars */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-wide">Bawat Antas (F1)</h3>
                            {['Mahusay', 'Papaunlad', 'Nagsisimula'].map(label => {
                                const cls = data.per_class[label];
                                if (!cls) return null;
                                const pct = Math.round(cls.f1 * 100);
                                return (
                                    <div key={label} className="flex items-center gap-3">
                                        <span className="w-28 text-xs font-semibold text-gray-700 shrink-0">{label}</span>
                                        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${cls.f1 >= 0.8 ? 'bg-teal-400' : cls.f1 >= 0.6 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className={`text-xs font-bold w-10 text-right ${f1Color(cls.f1)}`}>{cls.f1.toFixed(2)}</span>
                                        <span className="text-[10px] text-gray-400 w-8 text-right">({cls.support})</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Confusion Matrix */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-4">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-wide mb-3">Confusion Matrix</h3>
                            <p className="text-[10px] text-gray-400 mb-3">
                                Rows = {data.confusion_matrix.row_label} &nbsp;·&nbsp; Cols = {data.confusion_matrix.col_label}
                            </p>
                            <div className="overflow-x-auto">
                                <table className="text-xs w-full">
                                    <thead>
                                        <tr>
                                            <th className="w-24" />
                                            {data.confusion_matrix.labels.map(l => (
                                                <th key={l} className="text-center font-semibold text-gray-500 pb-2 px-1">{l}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.confusion_matrix.matrix.map((row, ri) => {
                                            const rowTotal = row.reduce((a, b) => a + b, 0) || 1;
                                            return (
                                                <tr key={ri}>
                                                    <td className="font-semibold text-gray-700 pr-2 py-1">{data.confusion_matrix.labels[ri]}</td>
                                                    {row.map((cell, ci) => {
                                                        const isDiag = ri === ci;
                                                        const bg = isDiag
                                                            ? 'bg-teal-100 text-teal-800'
                                                            : cell === 0
                                                                ? 'bg-white text-gray-300'
                                                                : 'bg-red-100 text-red-700';
                                                        return (
                                                            <td
                                                                key={ci}
                                                                className={`text-center font-bold px-3 py-2 rounded ${bg}`}
                                                                style={!isDiag && cell > 0 ? { opacity: 0.4 + 0.6 * (cell / rowTotal) } : {}}
                                                            >
                                                                {cell}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Per-dimension MAE */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-wide">
                                Bawat Dimensyon — MAE (mas mababa = mas tumpak)
                            </h3>
                            <div className="grid grid-cols-4 gap-1 text-[10px] text-gray-400 font-semibold uppercase pb-1 border-b border-gray-100">
                                <span>Dimensyon</span>
                                <span className="text-center">Sistema</span>
                                <span className="text-center">Guro</span>
                                <span>MAE</span>
                            </div>
                            {DIMS.map(dim => {
                                const d: DimensionMetrics | undefined = data.per_dimension[dim];
                                if (!d) return null;
                                return (
                                    <div key={dim} className="grid grid-cols-4 gap-1 items-center text-xs">
                                        <span className="font-semibold text-gray-700">{DIM_LABELS[dim]}</span>
                                        <span className="text-center text-gray-500">{d.avg_system != null ? d.avg_system.toFixed(1) : '—'}</span>
                                        <span className="text-center text-gray-500">{d.avg_teacher != null ? d.avg_teacher.toFixed(1) : '—'}</span>
                                        <div className="flex items-center gap-2">
                                            {d.mae != null ? (
                                                <>
                                                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${maeColor(d.mae)}`}
                                                            style={{ width: `${Math.min(100, d.mae * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className={`font-bold w-8 text-right ${d.mae <= 0.4 ? 'text-teal-600' : d.mae <= 0.7 ? 'text-amber-600' : 'text-red-600'}`}>
                                                        {d.mae.toFixed(2)}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
