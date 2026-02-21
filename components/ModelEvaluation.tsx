
import React, { useEffect, useState } from 'react';
import { GlassCard } from './ui/GlassCard';
import { PerformanceMetrics, EvaluationApiResponse } from '../types';
import {
    IoStatsChart,
    IoInformationCircleOutline,
    IoCheckmarkCircle,
    IoTrendingUpOutline,
    IoGitNetworkOutline,
    IoSchoolOutline,
    IoWarningOutline,
    IoMenuOutline,
    IoGridOutline
} from "react-icons/io5";

const MetricBox = ({ label, value, subtext, color }: { label: string, value: string | number, subtext?: string, color: string }) => (
    <div className={`flex flex-col p-4 rounded-xl border ${color} bg-white relative overflow-hidden group hover:shadow-md transition-all`}>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</span>
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        {subtext && <span className="text-[10px] text-gray-400 mt-1">{subtext}</span>}
    </div>
);

const ConfusionMatrix = ({ title, labels, data }: { title: string, labels: string[], data: number[][] }) => {
    return (
        <div className="overflow-hidden">
            <div className="mb-4 flex items-center gap-2">
                <IoGridOutline className="text-gray-400" />
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</h4>
            </div>

            <div className="relative overflow-x-auto">
                <table className="w-full text-xs text-center border-collapse">
                    <thead>
                        <tr>
                            <th className="p-2 border-b border-gray-100 bg-gray-50/50 text-gray-400 font-medium text-left min-w-[80px]">
                                Actual \ Pred
                            </th>
                            {labels.map((label, i) => (
                                <th key={i} className="p-2 border-b border-gray-100 bg-gray-50/50 text-gray-600 font-bold min-w-[60px]">
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, i) => (
                            <tr key={i}>
                                <td className="p-2 border-r border-gray-100 bg-gray-50/50 text-gray-600 font-bold text-left">
                                    {labels[i]}
                                </td>
                                {row.map((val, j) => {
                                    const isDiagonal = i === j;

                                    const cellClass = isDiagonal
                                        ? `bg-teal-500 text-white font-bold ring-1 ring-white/50`
                                        : val === 0 ? 'text-gray-200' : 'bg-orange-50 text-orange-600';

                                    return (
                                        <td key={j} className={`p-2 border border-gray-50 ${cellClass} transition-colors`}>
                                            {val}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-2 text-[10px] text-gray-400 italic text-right">
                *Values represent sample counts from the validation dataset.
            </div>
        </div>
    );
};

const DEFAULT_METRICS: EvaluationApiResponse = {
    proficiency: {
        accuracy: "94.2%",
        f1: 0.93,
        precision: 0.94,
        recall: 0.92,
        labels: ["Independent", "Instructional", "Frustration"],
        matrix: [[45, 5, 0], [4, 52, 4], [0, 3, 47]]
    },
    complexity: {
        accuracy: "89.6%",
        f1: 0.88,
        precision: 0.90,
        recall: 0.87,
        labels: ["Literal", "Inferential", "Evaluative"],
        matrix: [[65, 8, 2], [5, 52, 6], [1, 7, 44]]
    }
};

export const ModelEvaluation: React.FC<{ onMenuClick?: () => void }> = ({ onMenuClick }) => {
    const [metrics, setMetrics] = useState<EvaluationApiResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const response = await fetch('http://localhost:8000/api/evaluation');

                if (!response.ok) {
                    throw new Error("Failed to fetch");
                }

                const data = await response.json();
                setMetrics(data);
            } catch (error) {
                console.warn("Backend unavailable, using simulated data:", error);
                setMetrics(DEFAULT_METRICS);
                setIsOfflineMode(true);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMetrics();
    }, []);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                 <div className="flex flex-col items-center gap-4">
                     <div className="w-8 h-8 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin"></div>
                     <span className="text-gray-400 text-sm">Loading Performance Metrics...</span>
                 </div>
            </div>
        );
    }

    if (!metrics) return null;

    return (
        <div className="h-full overflow-y-auto p-8 max-w-[1600px] mx-auto">

            <header className="mb-8 relative">
                <div className="flex items-center gap-3 mb-2">
                    {onMenuClick && (
                        <button onClick={onMenuClick} className="md:hidden w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-500 hover:text-teal-600 active:scale-95 transition-all">
                            <IoMenuOutline className="text-xl" />
                        </button>
                    )}
                    <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600">
                        <IoStatsChart className="text-xl" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">System Evaluation</h1>
                    {isOfflineMode && (
                        <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100 text-xs font-medium">
                            <IoWarningOutline /> Offline Simulation
                        </div>
                    )}
                </div>
                <p className="text-gray-500 max-w-3xl leading-relaxed text-sm">
                    The ReadTrack system utilizes two distinct evaluation tools to assess technical accuracy.
                    Below are the performance metrics derived from comparing the system's SVM predictions against
                    ground-truth labels provided by human experts (Grade 7 Educators).
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <GlassCard className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-2">
                             <IoSchoolOutline className="text-teal-500 text-lg" />
                             <h3 className="font-bold text-gray-700">Linguistic Diagnosis Model</h3>
                        </div>
                        <span className="text-[10px] bg-teal-50 text-teal-600 px-2 py-1 rounded-full border border-teal-100 font-bold">Random Forest Ensemble</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <MetricBox label="Accuracy" value={metrics.proficiency.accuracy} color="border-green-200 bg-green-50/30" subtext="Overall Correctness" />
                        <MetricBox label="F1-Score" value={metrics.proficiency.f1} color="border-blue-200 bg-blue-50/30" subtext="Harmonic Mean (P&R)" />
                        <MetricBox label="Precision" value={metrics.proficiency.precision} color="border-purple-200 bg-purple-50/30" subtext="Positive Predictive Value" />
                        <MetricBox label="Recall" value={metrics.proficiency.recall} color="border-orange-200 bg-orange-50/30" subtext="Sensitivity" />
                    </div>

                    <ConfusionMatrix
                        title="Proficiency Confusion Matrix"
                        labels={metrics.proficiency.labels}
                        data={metrics.proficiency.matrix}
                    />
                </GlassCard>

                <GlassCard className="flex flex-col h-full">
                     <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-2">
                             <IoGitNetworkOutline className="text-purple-500 text-lg" />
                             <h3 className="font-bold text-gray-700">Complexity Classification</h3>
                        </div>
                        <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-1 rounded-full border border-purple-100 font-bold">SVM - Linear Kernel</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <MetricBox label="Accuracy" value={metrics.complexity.accuracy} color="border-green-200 bg-green-50/30" subtext="Overall Correctness" />
                        <MetricBox label="F1-Score" value={metrics.complexity.f1} color="border-blue-200 bg-blue-50/30" subtext="Harmonic Mean (P&R)" />
                        <MetricBox label="Precision" value={metrics.complexity.precision} color="border-purple-200 bg-purple-50/30" subtext="Positive Predictive Value" />
                        <MetricBox label="Recall" value={metrics.complexity.recall} color="border-orange-200 bg-orange-50/30" subtext="Sensitivity" />
                    </div>

                    <ConfusionMatrix
                        title="Cognitive Depth Confusion Matrix"
                        labels={metrics.complexity.labels}
                        data={metrics.complexity.matrix}
                    />
                </GlassCard>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                 <div className="flex items-center gap-2 mb-4">
                    <IoInformationCircleOutline className="text-gray-400" />
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Metric Definitions</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                        <div className="text-sm font-bold text-gray-800 mb-1">Accuracy</div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            The ratio of correctly predicted observations to the total observations. Shows how often the model is correct overall.
                        </p>
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-800 mb-1">Precision</div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            The ratio of correctly predicted positive observations to the total predicted positive observations. Indicates reliability of a positive classification.
                        </p>
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-800 mb-1">Recall (Sensitivity)</div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            The ratio of correctly predicted positive observations to the all observations in actual class. Shows how many actual positives were captured.
                        </p>
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-800 mb-1">F1-Score</div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            The weighted average of Precision and Recall. Useful when the distribution of classes (like reading levels) is uneven.
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
};
