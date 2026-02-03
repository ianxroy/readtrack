import React, { useState, useRef, useEffect } from 'react';
import { IoHelpCircleOutline } from "react-icons/io5";

export const MetricRow = ({ label, value, info }: { label: string, value: string, info?: string }) => {
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
