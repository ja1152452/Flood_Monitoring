export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm dark:shadow-none ${className}`}>
      {children}
    </div>
  );
}