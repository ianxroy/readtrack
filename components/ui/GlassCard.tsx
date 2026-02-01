import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = "", title, subtitle }) => {
  return (
    <div className={`
      relative overflow-hidden
      bg-white/85 backdrop-blur-xl 
      border border-white/40 
      rounded-[32px] p-6 shadow-xl 
      transition-all duration-300 hover:shadow-2xl hover:bg-white/90
      ${className}
    `}>
      {(title || subtitle) && (
        <div className="mb-6">
          {title && <h3 className="text-xl font-bold text-gray-800 tracking-tight">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-500 font-medium mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
};