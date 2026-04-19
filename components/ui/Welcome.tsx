import React from "react";
import { useNavigate } from "react-router-dom";

// Define the shape of our ToolCard props
interface ToolCardProps {
  title: string;
  description: string;
  icon: string;
  onClick?: () => void;
  hoverColor: "blue" | "green" | "purple"; // Restricting to specific theme colors
}

const ToolCard: React.FC<ToolCardProps> = ({ 
  title, 
  description, 
  icon, 
  onClick, 
  hoverColor 
}) => {
  // Mapping colors to Tailwind classes to ensure they aren't purged
  const colorMap = {
    blue: "hover:border-blue-500/50 focus:ring-blue-500 shadow-blue-500/10",
    green: "hover:border-green-500/50 focus:ring-green-500 shadow-green-500/10",
    purple: "hover:border-purple-500/50 focus:ring-purple-500 shadow-purple-500/10",
  };

  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center text-center p-8 
                 bg-gray-900 border border-gray-800 rounded-2xl 
                 transition-all duration-300 ease-out outline-none
                 hover:-translate-y-2 hover:bg-gray-800/50 hover:shadow-2xl 
                 focus:ring-2 ${colorMap[hoverColor]}`}
    >
      <span className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </span>
      <h3 className="text-xl font-bold mb-3 text-white">
        {title}
      </h3>
      <p className="text-gray-400 text-sm leading-relaxed">
        {description}
      </p>
    </button>
  );
};

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="flex-1 flex items-center justify-center px-6 min-h-[80vh]">
      <div className="max-w-4xl w-full">
        
        {/* Header Section */}
        <header className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl text-teal-500 font-extrabold mb-4 tracking-tight tracking-wide">
            Welcome to <span className=" text-transparent 
                         [text-stroke:2px_#14b8a6] 
                         [-webkit-text-stroke:2px_#14b8a6] 
                         drop-shadow-[0_0_15px_rgba(20,184,166,0.3)]">ReadTrack</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-md mx-auto">
            Select a classroom tool to review student work and reading materials.
          </p>
        </header>

        {/* Tool Cards Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          <ToolCard 
            title="Complexity Detection"
            description="Check whether a reading material is suitable for your Grade 7 class."
            icon="📊"
            hoverColor="blue"
            onClick={() => navigate("/material")}
          />
          
          <ToolCard 
            title="Essay Scoring"
            description="Review student essays, adjust ratings, and save teacher feedback."
            icon="📝"
            hoverColor="green"
            onClick={() => navigate("/student")}
          />
        </div>

      </div>
    </main>
  );
};

export default Welcome;