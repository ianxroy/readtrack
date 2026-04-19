 import React from 'react';
import { IoCloseOutline } from 'react-icons/io5';

function joinClasses(...classes: Array<string | null | undefined | false>): string {
  return classes.filter(Boolean).join(' ');
}

interface TeacherModalFrameProps {
  children: React.ReactNode;
  maxWidthClass?: string;
  panelClassName?: string;
}

export const TeacherModalFrame: React.FC<TeacherModalFrameProps> = ({
  children,
  maxWidthClass = 'max-w-4xl',
  panelClassName,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div
        className={joinClasses(
          'w-full max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl',
          maxWidthClass,
          panelClassName
        )}
      >
        {children}
      </div>
    </div>
  );
};

interface TeacherModalHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  onClose: () => void;
  closeLabel?: string;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

export const TeacherModalHeader: React.FC<TeacherModalHeaderProps> = ({
  title,
  subtitle,
  meta,
  actions,
  onClose,
  closeLabel = 'Close modal',
  className,
  titleClassName,
  subtitleClassName,
}) => {
  return (
    <div className={joinClasses('flex items-start justify-between px-7 pt-6 pb-5 border-b border-slate-100 flex-shrink-0', className)}>
      <div className="flex-1 min-w-0 pr-4">
        {meta ? <div className="flex items-center gap-2 mb-2 flex-wrap">{meta}</div> : null}
        <h2 className={joinClasses('text-xl font-black text-slate-900 tracking-tight', titleClassName)}>{title}</h2>
        {subtitle ? <p className={joinClasses('text-xs text-slate-500 mt-1', subtitleClassName)}>{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          aria-label={closeLabel}
        >
          <IoCloseOutline className="text-xl" />
        </button>
      </div>
    </div>
  );
};

export function teacherModalTabClass(active: boolean): string {
  return joinClasses(
    'px-4 py-3 text-xs font-semibold border-b-2 transition-colors',
    active
      ? 'border-indigo-500 text-indigo-700 bg-indigo-50/70'
      : 'border-transparent text-slate-400 hover:text-slate-600'
  );
}
