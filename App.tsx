import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { Dashboard } from "./components/Dashboard";
import { ModelEvaluation } from "./components/ModelEvaluation";
import GrammarChecker from "./components/GrammarChecker";
import { StudentGrading } from "./components/StudentGrading";
import { MaterialChecker } from "./components/MaterialChecker";
import Login from "./components/Login";
import { AuthProvider, useAuth } from "./context/AuthContext";

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
  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Login />} />

      {/* Protected shell — all app pages live here */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="h-screen w-screen bg-[#F2F2F7] text-gray-900 font-sans overflow-hidden">
              <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row h-full relative">
                <Navigation
                  isMobileOpen={isMobileMenuOpen}
                  onMobileClose={() => setIsMobileMenuOpen(false)}
                />

                <main className="flex-1 h-full overflow-hidden flex flex-col relative bg-[#F2F2F7]">
                  <Routes>
                    <Route
                      path="/"
                      element={<Dashboard view="welcome" onMenuClick={toggleMenu} />}
                    />
                    <Route
                      path="/student"
                      element={<StudentGrading onMenuClick={() => setIsMobileMenuOpen(true)} />}
                    />
                    <Route
                      path="/material"
                      element={<MaterialChecker onMenuClick={() => setIsMobileMenuOpen(true)} />}
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
