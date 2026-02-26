import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IoCloseOutline,
  IoGridOutline,
  IoAnalyticsOutline,
  IoSchoolOutline,
  IoLibraryOutline,
  IoLogOutOutline,
  IoPersonCircleOutline,
  IoTimeOutline,
  IoTrashOutline,
  IoChevronDownOutline,
  IoInformationCircleOutline
} from "react-icons/io5";
import { useAuth } from '../context/AuthContext';
import { CachedAnalysis } from '../types';

interface NavigationProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
  onItemClick?: () => void;
  history?: CachedAnalysis[];
  onSelectHistory?: (analysis: CachedAnalysis) => void;
  onDeleteHistory?: (id: string) => void;
}

// Group history items by relative date label
function groupByDate(items: CachedAnalysis[]): { label: string; items: CachedAnalysis[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);

  const groups: Record<string, CachedAnalysis[]> = {
    Today: [],
    Yesterday: [],
    'Last 7 days': [],
    Older: [],
  };

  for (const item of items) {
    const d = new Date(item.timestamp);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day >= today) groups['Today'].push(item);
    else if (day >= yesterday) groups['Yesterday'].push(item);
    else if (day >= lastWeek) groups['Last 7 days'].push(item);
    else groups['Older'].push(item);
  }

  return Object.entries(groups)
    .filter(([, v]) => v.length > 0)
    .map(([label, items]) => ({ label, items }));
}

const SidebarContent: React.FC<NavigationProps> = ({
  onItemClick,
  history = [],
  onSelectHistory,
  onDeleteHistory,
}) => {
  const { user, signOut } = useAuth();
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
    <NavLink
      to={to}
      onClick={onItemClick}
      className={({ isActive }) =>
        `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left mb-1
        ${isActive
          ? 'bg-teal-50 text-teal-700 font-semibold shadow-sm'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`text-lg ${isActive ? 'text-teal-500' : 'text-gray-400'}`} />
          <span className="text-sm">{label}</span>
          {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-500" />}
        </>
      )}
    </NavLink>
  );

  const grouped = groupByDate(history);

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100/50 shrink-0">
        <span className="text-lg font-bold text-teal-600 tracking-tight">ReadTrack</span>
      </div>

      {/* Scrollable middle section */}
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6">

        {/* Navigation menu */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Menu</div>
          <NavItem to="/" icon={IoGridOutline} label="Dashboard" />
          <NavItem to="/student" icon={IoSchoolOutline} label="Student Grading" />
          <NavItem to="/material" icon={IoLibraryOutline} label="Material Library" />
          <NavItem to="/evaluation" icon={IoAnalyticsOutline} label="Model Performance" />
          <NavItem to="/about" icon={IoInformationCircleOutline} label="About" />
        </div>

        {/* History section */}
        {history.length > 0 && (
          <div>
            <button
              onClick={() => setHistoryCollapsed(c => !c)}
              className="w-full flex items-center justify-between px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <IoTimeOutline className="text-sm" />
                History
              </span>
              <IoChevronDownOutline
                className={`text-xs transition-transform duration-200 ${historyCollapsed ? '-rotate-90' : ''}`}
              />
            </button>

            {!historyCollapsed && (
              <div className="space-y-4">
                {grouped.map(({ label, items }) => (
                  <div key={label}>
                    <div className="px-3 mb-1 text-[10px] font-semibold text-gray-300 uppercase tracking-wider">
                      {label}
                    </div>
                    {items.map(analysis => (
                      <div
                        key={analysis.id}
                        className="group relative flex items-center gap-2 w-full px-3 py-2 rounded-xl mb-0.5 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                        onMouseEnter={() => setHoveredId(analysis.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() => onSelectHistory?.(analysis)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-700 truncate">{analysis.title}</div>
                          <div className="text-[10px] text-gray-400">
                            {new Date(analysis.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {analysis.diagnosisResult && (
                              <span className="ml-1.5 text-teal-500 font-medium">{analysis.diagnosisResult.proficiency}</span>
                            )}
                          </div>
                        </div>
                        {hoveredId === analysis.id && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onDeleteHistory?.(analysis.id);
                            }}
                            className="shrink-0 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <IoTrashOutline className="text-xs" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User footer */}
      <div className="p-4 border-t border-gray-100 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <IoPersonCircleOutline className="text-2xl text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500 truncate flex-1" title={user?.email ?? ''}>
            {user?.email ?? 'Teacher'}
          </span>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <IoLogOutOutline className="text-lg" />
          <span className="text-xs font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export const Navigation: React.FC<NavigationProps> = (props) => {
  return (
    <>
      <div className="hidden md:flex flex-col w-[280px] h-screen sticky top-0 bg-white z-50 border-r border-gray-200/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <SidebarContent {...props} />
      </div>

      <AnimatePresence>
        {props.isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={props.onMobileClose}
              className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="md:hidden fixed inset-y-0 left-0 w-[80%] max-w-[300px] bg-white z-50 shadow-2xl border-r border-gray-100"
            >
              <button
                onClick={props.onMobileClose}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600"
              >
                <IoCloseOutline className="text-xl" />
              </button>
              <SidebarContent {...props} onItemClick={props.onMobileClose} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
