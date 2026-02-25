import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IoCloseOutline,
  IoGridOutline,
  IoAnalyticsOutline,
  IoSchoolOutline,
  IoLibraryOutline,
  IoLogOutOutline,
  IoPersonCircleOutline
} from "react-icons/io5";
import { useAuth } from '../context/AuthContext';

interface NavigationProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
  onItemClick?: () => void;
}

const SidebarContent: React.FC<NavigationProps> = ({ onItemClick }) => {
  const { user, signOut } = useAuth();

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <NavLink
        to={to}
        onClick={onItemClick}
        className={({ isActive }) => `
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left mb-1
            ${isActive 
                ? 'bg-teal-50 text-teal-700 font-semibold shadow-sm' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
        `}
    >
        {({ isActive }) => (
            <>
                <Icon className={`text-lg ${isActive ? 'text-teal-500' : 'text-gray-400'}`} />
                <span className="text-sm">{label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-500"></div>}
            </>
        )}
    </NavLink>
  );

  return (
    <div className="flex flex-col h-full">
        <div className="h-16 flex items-center px-6 border-b border-gray-100/50 shrink-0">
             <span className="text-lg font-bold text-teal-600 tracking-tight">ReadTrack</span>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4">
            <div className="mb-8">
                <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Menu</div>
                <NavItem to="/" icon={IoGridOutline} label="Dashboard" />        
                <NavItem to="/student" icon={IoSchoolOutline} label="Student Grading" />
                <NavItem to="/material" icon={IoLibraryOutline} label="Material Checker" />
                <NavItem to="/evaluation" icon={IoAnalyticsOutline} label="Model Performance" />
            </div>
        </div>

        <div className="p-4 border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-2 mb-3">
                <IoPersonCircleOutline className="text-2xl text-gray-400 shrink-0" />
                <span className="text-xs text-gray-500 truncate flex-1" title={user?.email ?? ''}>
                    {user?.email ?? 'Teacher'}
                </span>
            </div>
            <button
                onClick={signOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors text-sm"
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