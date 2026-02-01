import React, { useRef, useState } from 'react';
import { ReferenceFile, ViewState, CachedAnalysis } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  IoCloudUploadOutline,
  IoBookOutline,
  IoCheckmarkCircle,
  IoSettingsOutline,
  IoDocumentTextOutline,
    IoDocumentOutline,
    IoImageOutline,
  IoMenuOutline,
  IoGridOutline,
  IoAnalyticsOutline,
  IoCloseOutline,
  IoCheckmarkDoneOutline,
  IoTrashOutline
} from "react-icons/io5";

interface NavigationProps {
  activeView: ViewState;
  onViewChange: (view: ViewState) => void;
    onReferenceUpload: (files: { base64: string; mimeType: string; name: string }[], name: string) => void;
  savedReferences: ReferenceFile[];
  onDeleteReference?: (id: string) => void;
    onUpdateReference?: (id: string, files: { base64: string; mimeType: string; name: string }[]) => void;
  recentAnalyses?: CachedAnalysis[];
  onDeleteAnalysis?: (id: string) => void;
    onSelectAnalysis?: (analysis: CachedAnalysis) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

interface SidebarContentProps {
  activeView: ViewState;
  onViewChange: (view: ViewState) => void;
    onReferenceUpload: (files: { base64: string; mimeType: string; name: string }[], name: string) => void;
  savedReferences: ReferenceFile[];
  onDeleteReference?: (id: string) => void;
    onUpdateReference?: (id: string, files: { base64: string; mimeType: string; name: string }[]) => void;
  recentAnalyses?: CachedAnalysis[];
  onDeleteAnalysis?: (id: string) => void;
    onSelectAnalysis?: (analysis: CachedAnalysis) => void;
  onItemClick?: () => void; // For closing mobile drawer
}

// --- Reusable Content Component (Used in Desktop Sidebar & Mobile Drawer) ---
const SidebarContent: React.FC<SidebarContentProps> = ({ 
  activeView, 
  onViewChange, 
  onReferenceUpload, 
  savedReferences,
  onDeleteReference,
    onUpdateReference,
  recentAnalyses = [],
  onDeleteAnalysis,
    onSelectAnalysis,
  onItemClick 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
    const [activeReference, setActiveReference] = useState<ReferenceFile | null>(null);

    const openReferenceModal = (ref: ReferenceFile) => {
        setActiveReference(ref);
        setIsReferenceModalOpen(true);
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return <IoImageOutline className="text-teal-500" />;
        if (mimeType === 'application/pdf') return <IoDocumentOutline className="text-red-500" />;
        return <IoDocumentTextOutline className="text-blue-500" />;
    };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
            reader.onloadend = (event) => {
                const base64 = (event.target?.result as string).split(',')[1];
                onReferenceUpload([{ base64, mimeType: file.type, name: file.name }], file.name);
                setUploadedFileName(file.name);
                if (onItemClick) onItemClick(); // Close drawer on upload
            };
            reader.readAsDataURL(file); 
    }
  };

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button 
        onClick={() => {
            onViewChange(view);
            if (onItemClick) onItemClick();
        }}
        className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left mb-1
            ${activeView === view 
                ? 'bg-teal-50 text-teal-700 font-semibold shadow-sm' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
        `}
    >
        <Icon className={`text-lg ${activeView === view ? 'text-teal-500' : 'text-gray-400'}`} />
        <span className="text-sm">{label}</span>
        {activeView === view && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-500"></div>
        )}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
        {isReferenceModalOpen && activeReference && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 w-[420px] max-w-[90vw]">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <div className="text-sm font-semibold text-gray-800">{activeReference.name}</div>
                            <div className="text-[10px] text-gray-500">{activeReference.files.length} file(s)</div>
                        </div>
                        <button
                            onClick={() => setIsReferenceModalOpen(false)}
                            className="p-1.5 text-gray-400 hover:text-gray-600"
                        >
                            <IoCloseOutline className="text-lg" />
                        </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-3">
                            {activeReference.files.map((file, idx) => (
                                <div key={`${file.name}-${idx}`} className="relative border border-gray-100 rounded-2xl p-4 bg-white shadow-sm">
                                    <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-3 mx-auto">
                                        <div className="text-2xl">{getFileIcon(file.mimeType)}</div>
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                                        {file.mimeType}
                                    </div>
                                    <div className="text-xs text-gray-900/50 font-medium line-clamp-2 break-words min-h-[32px]">
                                        {file.name}
                                    </div>
                                    {onUpdateReference && (
                                        <button
                                            onClick={() => {
                                                const nextFiles = activeReference.files.filter((_, i) => i !== idx);
                                                onUpdateReference(activeReference.id, nextFiles);
                                                if (nextFiles.length === 0) {
                                                    onDeleteReference?.(activeReference.id);
                                                    setIsReferenceModalOpen(false);
                                                } else {
                                                    setActiveReference({ ...activeReference, files: nextFiles });
                                                }
                                            }}
                                            className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                            title="Remove file"
                                        >
                                            <IoTrashOutline className="text-sm" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={() => {
                                onReferenceUpload(activeReference.files, activeReference.name);
                                setUploadedFileName(activeReference.name);
                                onViewChange('dashboard');
                                setIsReferenceModalOpen(false);
                                if (onItemClick) onItemClick();
                            }}
                            className="flex-1 px-3 py-2 rounded-lg bg-teal-500 text-white text-xs font-semibold hover:bg-teal-600"
                        >
                            Use Workspace
                        </button>
                        <button
                            onClick={() => setIsReferenceModalOpen(false)}
                            className="flex-1 px-3 py-2 rounded-lg text-xs text-gray-600 hover:bg-gray-100"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}
        {/* Header Section (Only visible inside the container) */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100/50 shrink-0">
             <span className="text-lg font-bold text-teal-600 tracking-tight">ReadTrack</span>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4">
            
            {/* MAIN MENU */}
            <div className="mb-8">
                <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Menu
                </div>
                <NavItem view="dashboard" icon={IoGridOutline} label="Dashboard" />
                <NavItem view="evaluation" icon={IoAnalyticsOutline} label="Model Performance" />
            </div>

            {/* REFERENCES SECTION */}
            <div className="mb-8">
                <div className="px-3 mb-3 text-[11px] font-bold uppercase tracking-wider text-teal-600">
                    References
                </div>
                <div className="bg-white border border-teal-100 rounded-2xl shadow-sm p-3">
                
                {/* Upload Action */}
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="
                    mb-3 px-4 py-3 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50
                    hover:bg-teal-100 hover:border-teal-400 cursor-pointer transition-all duration-200
                    flex items-center gap-3 group
                    "
                >
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileChange}
                        accept=".txt,.md,.csv" 
                    />
                    <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                        {uploadedFileName ? <IoCheckmarkCircle /> : <IoCloudUploadOutline />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <div className="text-xs font-semibold text-teal-800 truncate group-hover:text-teal-900">
                            {uploadedFileName || "Upload References"}
                        </div>
                        <div className="text-[10px] text-teal-600/70">Add PDFs, images, or text files</div>
                    </div>
                </div>

                {/* Saved References List */}
                <div className="space-y-1">
                    {savedReferences.map((ref) => (
                        <div 
                            key={ref.id}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all group"
                        >
                            <button
                                onClick={() => openReferenceModal(ref)}
                                className="flex items-center gap-3 flex-1 text-left"
                            >
                                <IoBookOutline className="text-lg text-gray-400 group-hover:text-teal-500 transition-colors" />
                                <div className="flex-1 overflow-hidden">
                                    <div className="text-sm text-gray-600 group-hover:text-gray-900 truncate">{ref.name}</div>
                                    <div className="text-[10px] text-gray-400">{ref.date}</div>
                                </div>
                            </button>
                            {onDeleteReference && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteReference(ref.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                    title="Delete reference"
                                >
                                    <IoTrashOutline className="text-sm" />
                                </button>
                            )}
                        </div>
                    ))}
                    {savedReferences.length === 0 && (
                        <div className="px-3 text-[11px] text-gray-400 italic">
                            No saved references
                        </div>
                    )}
                </div>
                </div>
            </div>

            {/* RECENT ANALYSIS SECTION */}
            <div>
                <div className="px-3 mb-3 text-[11px] font-bold uppercase tracking-wider text-teal-500">
                    Recent Analysis
                </div>
                <div className="space-y-1">
                    {recentAnalyses.map((analysis) => (
                        <div 
                            key={analysis.id}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all group"
                        >
                            <button
                                onClick={() => {
                                    onSelectAnalysis?.(analysis);
                                    onViewChange('dashboard');
                                    if (onItemClick) onItemClick();
                                }}
                                className="flex items-center gap-2 flex-1 text-left min-w-0"
                            >
                                <IoDocumentTextOutline className="text-lg text-teal-500" />
                                <div className="overflow-hidden flex-1 min-w-0">
                                    <div className="text-sm text-gray-700 font-medium group-hover:text-teal-700 transition-colors line-clamp-2 break-words">
                                        {analysis.title}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                        {new Date(analysis.timestamp).toLocaleDateString()}
                                    </div>
                                </div>
                            </button>
                            {onDeleteAnalysis && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteAnalysis(analysis.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                    title="Delete analysis"
                                >
                                    <IoTrashOutline className="text-sm" />
                                </button>
                            )}
                        </div>
                    ))}
                    {recentAnalyses.length === 0 && (
                        <div className="px-3 text-[11px] text-gray-400 italic">
                            No recent history
                        </div>
                    )}
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between shrink-0">
            <button className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors">
                <IoSettingsOutline className="text-lg"/>
                <span className="text-xs font-medium">Settings</span>
            </button>
            <div className="text-[10px] font-mono text-gray-300">v1.2.0</div>
        </div>
    </div>
  );
};


// --- Main Navigation Container ---
export const Navigation: React.FC<NavigationProps> = (props) => {
  return (
    <>
      {/* 1. Desktop Sidebar (Hidden on Mobile) */}
      <div className="hidden md:flex flex-col w-[280px] h-screen sticky top-0 bg-white z-50 border-r border-gray-200/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
         <SidebarContent {...props} />
      </div>

      {/* 2. Mobile Drawer Overlay */}
      <AnimatePresence>
        {props.isMobileOpen && (
            <>
                {/* Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={props.onMobileClose}
                    className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                />
                
                {/* Drawer Panel */}
                <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="md:hidden fixed inset-y-0 left-0 w-[80%] max-w-[300px] bg-white z-50 shadow-2xl border-r border-gray-100"
                >
                    {/* Close Button inside Drawer */}
                    <button 
                        onClick={props.onMobileClose}
                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600"
                    >
                        <IoCloseOutline className="text-xl" />
                    </button>

                    {/* Content */}
                    <SidebarContent {...props} onItemClick={props.onMobileClose} />
                </motion.div>
            </>
        )}
      </AnimatePresence>
    </>
  );
};
