import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { Dashboard } from "./components/Dashboard";
import { ModelEvaluation } from "./components/ModelEvaluation";
import GrammarChecker from "./components/GrammarChecker";
import { StudentGrading } from "./components/StudentGrading";
import { MaterialLibrary } from "./components/MaterialLibrary";
import Login from "./components/Login";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CachedAnalysis } from "./types";

const HISTORY_KEY = "readtrack_history";

function loadHistory(): CachedAnalysis[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((a: any) => ({ ...a, timestamp: new Date(a.timestamp) }));
  } catch {
    return [];
  }
}

// Wraps any route — redirects to /login if the user is not authenticated
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F2F2F7]">
        <div className="w-6 h-6 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [history, setHistory] = useState<CachedAnalysis[]>(loadHistory);
  const [selectedAnalysis, setSelectedAnalysis] = useState<CachedAnalysis | null>(null);
  const navigate = useNavigate();

  // Persist history changes to localStorage
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const handleSaveAnalysis = (analysis: CachedAnalysis) => {
    setHistory(prev => [analysis, ...prev].slice(0, 50));
  };

  const handleSelectHistory = (analysis: CachedAnalysis) => {
    setSelectedAnalysis(analysis);
    navigate("/student");
    setIsMobileMenuOpen(false);
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(prev => prev.filter(a => a.id !== id));
    if (selectedAnalysis?.id === id) setSelectedAnalysis(null);
  };

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Login />} />

      {/* Protected shell */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="h-screen w-screen bg-[#F2F2F7] text-gray-900 font-sans overflow-hidden">
              <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row h-full relative">
                <Navigation
                  isMobileOpen={isMobileMenuOpen}
                  onMobileClose={() => setIsMobileMenuOpen(false)}
                  history={history}
                  onSelectHistory={handleSelectHistory}
                  onDeleteHistory={handleDeleteHistory}
                />

                <main className="flex-1 h-full overflow-hidden flex flex-col relative bg-[#F2F2F7]">
                  <Routes>
                    <Route
                      path="/"
                      element={<Dashboard view="welcome" onMenuClick={toggleMenu} />}
                    />
                    <Route
                      path="/student"
                      element={
                        <StudentGrading
                          onMenuClick={() => setIsMobileMenuOpen(true)}
                          onSaveAnalysis={handleSaveAnalysis}
                          selectedAnalysis={selectedAnalysis}
                        />
                      }
                    />
                    <Route
                      path="/material"
                      element={<MaterialLibrary onMenuClick={() => setIsMobileMenuOpen(true)} />}
                    />
                    <Route path="/grammar" element={<GrammarChecker />} />
                    <Route
                      path="/evaluation"
                      element={<ModelEvaluation onMenuClick={() => setIsMobileMenuOpen(true)} />}
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;
