import React, { useState, useEffect } from 'react';
import { ViewState, ReferenceFile, CachedAnalysis } from './types';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { ChatInterface } from './components/ChatInterface';
import { ModelEvaluation } from './components/ModelEvaluation';
import GrammarChecker from './components/GrammarChecker';
import { motion, AnimatePresence } from 'framer-motion';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [referenceFiles, setReferenceFiles] = useState<{ base64: string; mimeType: string; name: string }[]>([]);
  const [referenceFileName, setReferenceFileName] = useState<string>("");
  const [savedReferences, setSavedReferences] = useState<ReferenceFile[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<CachedAnalysis[]>([]);
  const [hasLoadedCache, setHasLoadedCache] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<CachedAnalysis | null>(null);

  // Load saved data from localStorage on mount
  useEffect(() => {
    const savedRefs = localStorage.getItem('readtrack_references');
    const savedAnalyses = localStorage.getItem('readtrack_analyses');
    const savedWorkspace = localStorage.getItem('readtrack_reference_workspace');
    
    if (savedRefs) {
      try {
        const parsed: ReferenceFile[] = JSON.parse(savedRefs);
        const normalized = parsed.map((ref: any) => {
          if (ref.files && Array.isArray(ref.files)) {
            return ref;
          }
          if (ref.content) {
            const utf8 = encodeURIComponent(ref.content);
            const base64 = btoa(utf8.replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
            return {
              id: ref.id,
              name: ref.name,
              files: [{ base64, mimeType: 'text/plain', name: ref.name }],
              date: ref.date || new Date().toLocaleDateString()
            } as ReferenceFile;
          }
          return { ...ref, files: [] } as ReferenceFile;
        });
        setSavedReferences(normalized);
      } catch (e) {
        console.error('Failed to load references:', e);
      }
    }
    
    if (savedAnalyses) {
      try {
        const parsed: CachedAnalysis[] = JSON.parse(savedAnalyses);
        const normalized = parsed.map((analysis) => {
          if (!analysis.title) {
            const firstLine = (analysis.studentText || "").split("\n").find((line) => line.trim().length > 0) || "Untitled Analysis";
            const title = firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine;
            return { ...analysis, title };
          }
          return analysis;
        });
        setRecentAnalyses(normalized);
      } catch (e) {
        console.error('Failed to load analyses:', e);
      }
    }

    if (savedWorkspace) {
      try {
        const workspace = JSON.parse(savedWorkspace) as { name: string; files: { base64: string; mimeType: string; name: string }[] };
        if (workspace?.files?.length) {
          setReferenceFiles(workspace.files);
          setReferenceFileName(workspace.name || "");
        }
      } catch (e) {
        console.error('Failed to load reference workspace:', e);
      }
    }

    setHasLoadedCache(true);
  }, []);

  // Save references to localStorage whenever they change
  useEffect(() => {
    if (!hasLoadedCache) return;
    localStorage.setItem('readtrack_references', JSON.stringify(savedReferences));
  }, [savedReferences, hasLoadedCache]);

  // Save analyses to localStorage whenever they change
  useEffect(() => {
    if (!hasLoadedCache) return;
    localStorage.setItem('readtrack_analyses', JSON.stringify(recentAnalyses));
  }, [recentAnalyses, hasLoadedCache]);

  // Save selected reference workspace to localStorage
  useEffect(() => {
    if (!hasLoadedCache) return;
    if (referenceFiles.length > 0) {
      localStorage.setItem('readtrack_reference_workspace', JSON.stringify({
        name: referenceFileName,
        files: referenceFiles
      }));
    }
  }, [referenceFiles, referenceFileName, hasLoadedCache]);

  const handleReferenceUpload = (files: { base64: string; mimeType: string; name: string }[], name: string) => {
    setReferenceFiles(files);
    setReferenceFileName(name);
  };

  const handleSaveReference = (name: string, files: { base64: string; mimeType: string; name: string }[]) => {
    const newFile: ReferenceFile = {
        id: Date.now().toString(),
        name: name,
        files,
        date: new Date().toLocaleDateString()
    };
    setSavedReferences(prev => [newFile, ...prev]);
    setReferenceFileName(newFile.name);
  };

  const handleDeleteReference = (id: string) => {
    setSavedReferences(prev => prev.filter(ref => ref.id !== id));
  };

  const handleUpdateReference = (id: string, files: { base64: string; mimeType: string; name: string }[]) => {
    setSavedReferences(prev => prev.map(ref => ref.id === id ? { ...ref, files } : ref));
  };

  const handleSaveAnalysis = (analysis: CachedAnalysis) => {
    setRecentAnalyses(prev => [analysis, ...prev].slice(0, 20)); // Keep last 20
  };

  const handleDeleteAnalysis = (id: string) => {
    setRecentAnalyses(prev => prev.filter(a => a.id !== id));
    setSelectedAnalysis(prev => (prev?.id === id ? null : prev));
  };

  const handleSelectAnalysis = (analysis: CachedAnalysis) => {
    setSelectedAnalysis(analysis);
    setActiveView('dashboard');
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="h-screen w-screen bg-[#F2F2F7] text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
      
      <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row h-full relative">
        
        {/* Navigation - Sidebar on Desktop */}
        <Navigation 
            activeView={activeView} 
            onViewChange={setActiveView} 
            onReferenceUpload={handleReferenceUpload}
            savedReferences={savedReferences}
            onDeleteReference={handleDeleteReference}
          onUpdateReference={handleUpdateReference}
            recentAnalyses={recentAnalyses}
            onDeleteAnalysis={handleDeleteAnalysis}
          onSelectAnalysis={handleSelectAnalysis}
            isMobileOpen={isMobileMenuOpen}
            onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 h-full overflow-hidden flex flex-col relative bg-[#F2F2F7]">
          
          <AnimatePresence mode='wait'>
            <motion.div
              key={activeView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col h-full min-h-0"
            >
               {activeView === 'dashboard' ? (
                   <Dashboard 
                        referenceFiles={referenceFiles}
                        referenceFileName={referenceFileName} 
                        onSaveReference={handleSaveReference}
                        onSaveAnalysis={handleSaveAnalysis}
                        selectedAnalysis={selectedAnalysis}
                        onMenuClick={() => setIsMobileMenuOpen(true)}
                    />
               ) : activeView === 'grammar' ? (
                   <GrammarChecker />
               ) : (
                   <ModelEvaluation 
                        onMenuClick={() => setIsMobileMenuOpen(true)}
                   />
               )}
            </motion.div>
          </AnimatePresence>

        </main>
      </div>
    </div>
  );
};

export default App;
