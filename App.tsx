import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { Dashboard } from "./components/Dashboard";
import { ModelEvaluation } from "./components/ModelEvaluation";
import GrammarChecker from "./components/GrammarChecker";
import { StudentGrading } from "./components/StudentGrading";
import { MaterialChecker } from "./components/MaterialChecker";

const App: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
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
              element={
                <StudentGrading
                  onMenuClick={() => setIsMobileMenuOpen(true)}
                  // Remove reference props previously passed here
                />
              }
            />
            <Route
              path="/material"
              element={
                <MaterialChecker
                  onMenuClick={() => setIsMobileMenuOpen(true)}
                  // Remove reference props previously passed here
                />
              }
            />
            <Route path="/grammar" element={<GrammarChecker />} />
            <Route
              path="/evaluation"
              element={
                <ModelEvaluation
                  onMenuClick={() => setIsMobileMenuOpen(true)}
                />
              }
            />
            {/* Fallback to Dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default App;
