import { NavLink } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

export function DailyOperationsTutorial({ collapsed }: { collapsed: boolean }) {
  return (
    <NavLink
      to="/tutorial/dia-a-dia"
      className={({ isActive }) =>
        `group flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
          isActive
            ? 'border-white/30 bg-white/15 text-white shadow-sm'
            : 'border-aviation-400/25 bg-aviation-500/10 text-aviation-200 hover:border-aviation-300/50 hover:bg-aviation-500/20 hover:text-white'
        } ${collapsed ? 'px-0' : ''}`
      }
      title="Tutorial do dia a dia"
    >
      <HelpCircle className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
      {!collapsed && <span>Tutorial</span>}
    </NavLink>
  );
}
