import React from 'react';
import { IoMenuOutline } from 'react-icons/io5';

// ─── Design tokens ────────────────────────────────────────────────────────────
// Primary:   teal-500  (#14b8a6)
// Bg:        #F5F4F0  (warm off-white — consistent across all pages)
// Card:      white / border-gray-100 / rounded-2xl / shadow-sm
// Label:     text-[10px] uppercase tracking-widest font-bold text-gray-400

// ─── Page shell ───────────────────────────────────────────────────────────────

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  onMenuClick?: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ icon, title, badge, actions, onMenuClick }) => (
  <header className="h-14 flex items-center justify-between px-5 border-b border-gray-100 bg-white shadow-sm shrink-0">
    <div className="flex items-center gap-2 min-w-0">
      {onMenuClick && (
        <button onClick={onMenuClick} className="md:hidden text-gray-500 hover:text-gray-700 shrink-0 mr-1">
          <IoMenuOutline className="text-2xl" />
        </button>
      )}
      <span className="text-teal-500 text-xl shrink-0">{icon}</span>
      <h1 className="text-base font-bold text-gray-800 truncate">{title}</h1>
      {badge !== undefined && (
        <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
          {badge}
        </span>
      )}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </header>
);

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', padding = 'p-5' }) => (
  <div className={`bg-white border border-gray-100 rounded-2xl shadow-sm ${padding} ${className}`}>
    {children}
  </div>
);

// ─── Section label ─────────────────────────────────────────────────────────────

export const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`text-[10px] font-bold uppercase tracking-widest text-gray-400 ${className}`}>
    {children}
  </div>
);

// ─── Spinner ──────────────────────────────────────────────────────────────────

export const Spinner: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex flex-col items-center justify-center gap-3">
    <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
    <p className="text-sm text-gray-400">{label}</p>
  </div>
);

// ─── Primary button ───────────────────────────────────────────────────────────

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: React.ReactNode;
}

const BTN_VARIANTS: Record<NonNullable<BtnProps['variant']>, string> = {
  primary:   'bg-teal-500 hover:bg-teal-600 text-white font-bold shadow-sm disabled:opacity-60',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold disabled:opacity-60',
  ghost:     'text-teal-600 hover:bg-teal-50 font-semibold disabled:opacity-60',
  danger:    'bg-rose-500 hover:bg-rose-600 text-white font-bold shadow-sm disabled:opacity-60',
};

const BTN_SIZES: Record<NonNullable<BtnProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-xl',
  md: 'px-4 py-2 text-sm rounded-xl',
};

export const Btn: React.FC<BtnProps> = ({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}) => (
  <button
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center gap-1.5 transition-colors ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`}
    {...rest}
  >
    {loading
      ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      : icon}
    {children}
  </button>
);

// ─── Status pill ──────────────────────────────────────────────────────────────

interface PillProps {
  color: 'green' | 'orange' | 'red' | 'teal' | 'indigo' | 'gray' | 'amber' | 'rose' | 'sky';
  children: React.ReactNode;
  dot?: boolean;
}

const PILL_COLORS: Record<PillProps['color'], string> = {
  green:  'bg-green-50  text-green-700  border-green-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  red:    'bg-rose-50   text-rose-700   border-rose-200',
  teal:   'bg-teal-50   text-teal-700   border-teal-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  gray:   'bg-gray-100  text-gray-500   border-gray-200',
  amber:  'bg-amber-50  text-amber-700  border-amber-200',
  rose:   'bg-rose-50   text-rose-700   border-rose-200',
  sky:    'bg-sky-50    text-sky-700    border-sky-200',
};

const DOT_COLORS: Record<PillProps['color'], string> = {
  green:  'bg-green-500',
  orange: 'bg-orange-500',
  red:    'bg-rose-500',
  teal:   'bg-teal-500',
  indigo: 'bg-indigo-500',
  gray:   'bg-gray-400',
  amber:  'bg-amber-500',
  rose:   'bg-rose-500',
  sky:    'bg-sky-500',
};

export const Pill: React.FC<PillProps> = ({ color, children, dot }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${PILL_COLORS[color]}`}>
    {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLORS[color]}`} />}
    {children}
  </span>
);

// ─── Empty state ──────────────────────────────────────────────────────────────

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; description?: string }> = ({
  icon,
  title,
  description,
}) => (
  <div className="flex flex-col items-center justify-center flex-1 py-16 text-center">
    {icon && <div className="text-4xl text-gray-200 mb-4">{icon}</div>}
    <p className="text-sm font-semibold text-gray-400">{title}</p>
    {description && <p className="text-xs text-gray-300 mt-1 max-w-xs">{description}</p>}
  </div>
);
