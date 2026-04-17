import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { Dashboard } from "./components/Dashboard";
import GrammarChecker from "./components/GrammarChecker";
import { StudentGrading } from "./components/StudentGrading";
import { MaterialLibrary } from "./components/MaterialLibrary";
import { About } from "./components/About";
import Login from "./components/Login";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CachedAnalysis } from "./types";

import { loadStudentUploads, deleteStudentUpload, StudentLocal } from "./services/supabaseService";

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
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [history, setHistory] = useState<CachedAnalysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<CachedAnalysis | null>(null);
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Load history from Supabase when user is logged in
  useEffect(() => {
    if (user) {
      loadStudentUploads().then(({ data }) => {
        // Flatten students' essays into a list for the sidebar history
        const allEssays: CachedAnalysis[] = (data as StudentLocal[]).flatMap(student => 
          student.essays.map(essay => ({
            id: essay.id,
            timestamp: essay.uploadedAt,
            title: `${student.name.trim() || 'Student'} \u2022 ${essay.title}`,
            studentText: essay.text,
            diagnosisResult: essay.diagnosisResult,
            complexityResult: essay.complexityResult,
          }))
        ).sort((a, b) => +b.timestamp - +a.timestamp).slice(0, 30);
        
        setHistory(allEssays);
      });
    }
  }, [user]);

  const handleSaveAnalysis = (analysis: CachedAnalysis) => {
    setHistory(prev => [analysis, ...prev].slice(0, 30));
    setDashboardRefreshToken(prev => prev + 1);
  };

  const handleDashboardDataChange = () => {
    setDashboardRefreshToken(prev => prev + 1);
  };

  const handleSelectHistory = (analysis: CachedAnalysis) => {
    // Clone to ensure selecting the same history item twice still triggers downstream effects.
    setSelectedAnalysis({ ...analysis });
    navigate("/student");
    setIsMobileMenuOpen(false);
  };

  const handleDeleteHistory = async (id: string) => {
    setHistory(prev => prev.filter(a => a.id !== id));
    if (selectedAnalysis?.id === id) setSelectedAnalysis(null);
    await deleteStudentUpload(id);
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

                <main className="flex-1 h-full min-h-0 overflow-hidden flex flex-col relative bg-[#F2F2F7]">
                  <Routes>
                    <Route path="/evaluation" element={<Navigate to="/about" replace />} />
                    <Route path="/" element={<></>} />
                    <Route path="/student" element={<></>} />
                    <Route path="/material" element={<></>} />
                    <Route path="/grammar" element={<></>} />
                    <Route path="/about" element={<></>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>

                  <div className={`h-full min-h-0 ${location.pathname === '/' ? 'block' : 'hidden'}`}>
                    <Dashboard view="welcome" onMenuClick={toggleMenu} refreshToken={dashboardRefreshToken} />
                  </div>
                  <div className={`h-full min-h-0 ${location.pathname === '/student' ? 'block' : 'hidden'}`}>
                    <StudentGrading
                      onMenuClick={() => setIsMobileMenuOpen(true)}
                      onSaveAnalysis={handleSaveAnalysis}
                      onDataChanged={handleDashboardDataChange}
                      selectedAnalysis={selectedAnalysis}
                    />
                  </div>
                  <div className={`h-full min-h-0 ${location.pathname === '/material' ? 'block' : 'hidden'}`}>
                    <MaterialLibrary onMenuClick={() => setIsMobileMenuOpen(true)} onDataChanged={handleDashboardDataChange} />
                  </div>
                  <div className={`h-full min-h-0 ${location.pathname === '/grammar' ? 'block' : 'hidden'}`}>
                    <GrammarChecker />
                  </div>
                  <div className={`h-full min-h-0 ${location.pathname === '/about' ? 'block' : 'hidden'}`}>
                    <About onMenuClick={() => setIsMobileMenuOpen(true)} />
                  </div>
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
