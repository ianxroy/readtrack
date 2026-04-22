import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IoCloseOutline,
  IoGridOutline,
  IoSchoolOutline,
  IoLibraryOutline,
  IoLogOutOutline,
  IoTimeOutline,
  IoTrashOutline,
  IoChevronDownOutline,
  IoInformationCircleOutline,
  IoSettingsOutline,
  IoCheckmarkCircleOutline,
} from "react-icons/io5";
import { useAuth } from '../context/AuthContext';
import { CachedAnalysis } from '../types';
import { useT } from '../services/i18n';

interface NavigationProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
  onItemClick?: () => void;
  history?: CachedAnalysis[];
  onSelectHistory?: (analysis: CachedAnalysis) => void;
  onDeleteHistory?: (id: string) => void;
}

function groupByDate(items: CachedAnalysis[], labels: { today: string; yesterday: string; last7: string; older: string }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);

  const groups: Record<string, CachedAnalysis[]> = {
    [labels.today]: [],
    [labels.yesterday]: [],
    [labels.last7]: [],
    [labels.older]: [],
  };

  for (const item of items) {
    const d = new Date(item.timestamp);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day >= today) groups[labels.today].push(item);
    else if (day >= yesterday) groups[labels.yesterday].push(item);
    else if (day >= lastWeek) groups[labels.last7].push(item);
    else groups[labels.older].push(item);
  }

  return Object.entries(groups)
    .filter(([, v]) => v.length > 0)
    .map(([label, items]) => ({ label, items }));
}

const PROF_COLOR: Record<string, string> = {
  Mahusay: 'text-emerald-400',
  Papaunlad: 'text-amber-400',
  Nagsisimula: 'text-rose-400',
};

const SidebarContent: React.FC<NavigationProps> = ({
  onItemClick,
  history = [],
  onSelectHistory,
  onDeleteHistory,
}) => {
  const { user, signOut } = useAuth();
  const t = useT();
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const NavItem = ({
    to,
    icon: Icon,
    label,
    badge,
  }: {
    to: string;
    icon: React.ElementType;
    label: string;
    badge?: string;
  }) => (
    <NavLink
      to={to}
      onClick={onItemClick}
      className={({ isActive }) =>
        `group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left mb-0.5
        ${isActive
          ? 'bg-teal-500/20 text-teal-300 font-semibold'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-teal-400 rounded-r-full" />
          )}
          <Icon className={`text-base shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
          <span className="text-sm flex-1">{label}</span>
          {badge && (
            <span className="text-[10px] font-bold bg-white/10 text-slate-400 px-1.5 py-0.5 rounded-md">{badge}</span>
          )}
        </>
      )}
    </NavLink>
  );

  const grouped = groupByDate(history, {
    today: t('nav_today'),
    yesterday: t('nav_yesterday'),
    last7: t('nav_last_7_days'),
    older: t('nav_older'),
  });
  const email = user?.email ?? '';
  const initials = email ? email.slice(0, 2).toUpperCase() : 'T';

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Brand */}
      <div className="h-16 flex items-center px-5 shrink-0 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center shrink-0">
            <span className="text-white font-black text-xs">RT</span>
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight leading-none">ReadTrack</div>
            <div className="text-[10px] text-slate-500 leading-none mt-0.5">DepEd Grade 7</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-5 px-3 space-y-6 scrollbar-none">
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            Main
          </div>
          <NavItem to="/" icon={IoGridOutline} label={t('nav_dashboard')} />
          <NavItem to="/student" icon={IoSchoolOutline} label={t('nav_essay_grading')} />
          <NavItem to="/material" icon={IoLibraryOutline} label={t('nav_material_library')} />
        </div>

        {/* History */}
        {history.length > 0 && (
          <div>
            <button
              onClick={() => setHistoryCollapsed(c => !c)}
              className="w-full flex items-center justify-between px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <IoTimeOutline className="text-xs" />
                {t('nav_recent')}
              </span>
              <IoChevronDownOutline
                className={`text-xs transition-transform duration-200 ${historyCollapsed ? '-rotate-90' : ''}`}
              />
            </button>

            {!historyCollapsed && (
              <div className="space-y-3">
                {grouped.map(({ label, items }) => (
                  <div key={label}>
                    <div className="px-3 mb-1 text-[9px] font-semibold text-slate-700 uppercase tracking-widest">
                      {label}
                    </div>
                    {items.map(analysis => {
                      const prof = analysis.diagnosisResult?.proficiency;
                      return (
                        <div
                          key={analysis.id}
                          className="group relative flex items-center gap-2 w-full px-3 py-2 rounded-xl mb-0.5 cursor-pointer hover:bg-white/5 transition-colors"
                          onMouseEnter={() => setHoveredId(analysis.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          onClick={() => onSelectHistory?.(analysis)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-300 truncate">{analysis.title}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] text-slate-600">
                                {new Date(analysis.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {prof && (
                                <span className={`text-[9px] font-bold ${PROF_COLOR[prof] ?? 'text-slate-500'}`}>
                                  {prof}
                                </span>
                              )}
                            </div>
                          </div>
                          {hoveredId === analysis.id && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onDeleteHistory?.(analysis.id);
                              }}
                              className="shrink-0 p-1 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                            >
                              <IoTrashOutline className="text-xs" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/5 p-3 space-y-0.5">
        <NavLink
          to="/settings"
          onClick={onItemClick}
          className={({ isActive }) =>
            `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left mb-0.5 ${
              isActive ? 'bg-teal-500/20 text-teal-300 font-semibold' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
            }`
          }
        >
          <IoSettingsOutline className="text-base" />
          <span className="text-sm">{t('nav_settings')}</span>
        </NavLink>

        <NavLink
          to="/about"
          onClick={onItemClick}
          className={({ isActive }) =>
            `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left mb-0.5 ${
              isActive ? 'bg-teal-500/20 text-teal-300 font-semibold' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
            }`
          }
        >
          <IoInformationCircleOutline className="text-base" />
          <span className="text-sm">{t('nav_about')}</span>
        </NavLink>

        {/* User row */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-slate-300">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-slate-400 truncate">{email || 'Teacher'}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <IoCheckmarkCircleOutline className="text-emerald-500 text-[10px]" />
              <span className="text-[9px] text-slate-600">{t('nav_signed_in')}</span>
            </div>
          </div>
          <button
            onClick={signOut}
            className="shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
            title="Sign out"
          >
            <IoLogOutOutline className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const Navigation: React.FC<NavigationProps> = (props) => {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex flex-col w-[240px] h-screen sticky top-0 z-50 shadow-xl">
        <SidebarContent {...props} />
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {props.isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={props.onMobileClose}
              className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="md:hidden fixed inset-y-0 left-0 w-[260px] z-50 shadow-2xl"
            >
              <button
                onClick={props.onMobileClose}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white z-10"
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
