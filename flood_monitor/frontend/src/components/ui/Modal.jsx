import { X } from 'lucide-react';

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-lg', className = '', headerActions = null }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150">
      <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl w-full ${maxWidth} shadow-2xl flex flex-col max-h-[96vh] transition-all duration-200 ${className}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">{title}</h3>
          <div className="flex items-center gap-2">
            {headerActions}
            <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col">{children}</div>
      </div>
    </div>
  );
}