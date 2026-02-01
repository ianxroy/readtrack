import React, { useState } from 'react';
import { GlassCard } from './ui/GlassCard';

// Define the expected structure of the analysis result from the backend
interface AnalysisResult {
    level?: string;
    score?: number;
    reasoning?: string;
    readabilityScore?: number;
    wordCount?: number;
    keywords?: string[];
    // Add other potential fields from your backend response
    [key: string]: any;
}

export const ChatInterface: React.FC = () => {
    const [inputText, setInputText] = useState<string>('');
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        if (!inputText.trim()) {
            setError('Please enter some text to analyze.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        try {
            const response = await fetch('http://localhost:8000/test-complexity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                },
                body: JSON.stringify({ text: inputText }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data: AnalysisResult = await response.json();
            setAnalysisResult(data);

        } catch (e: any) {
            console.error("Failed to analyze text:", e);
            setError(e.message || "An unexpected error occurred. Make sure the backend server is running.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full p-4">
            <h2 className="text-2xl font-bold text-white mb-4">Text Analysis Interface</h2>
            
            <div className="flex-grow flex flex-col">
                <textarea
                    className="w-full flex-grow p-4 rounded-lg bg-gray-800 bg-opacity-60 text-white border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                    placeholder="Enter text here for complexity analysis..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                />
                <button
                    onClick={handleAnalyze}
                    disabled={isLoading}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition"
                >
                    {isLoading ? 'Analyzing...' : 'Analyze Text'}
                </button>
            </div>

            <div className="mt-6">
                {error && (
                    <GlassCard>
                        <h3 className="text-red-400 font-bold">Error</h3>
                        <p className="text-red-300 mt-2">{error}</p>
                    </GlassCard>
                )}
                {analysisResult && (
                    <GlassCard>
                        <h3 className="text-white font-bold text-xl mb-2">Analysis Result</h3>
                        <pre className="text-left bg-gray-900 bg-opacity-70 p-4 rounded-md overflow-x-auto text-sm">
                            {JSON.stringify(analysisResult, null, 2)}
                        </pre>
                    </GlassCard>
                )}
            </div>
        </div>
    );
};
