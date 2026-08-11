import type { LucideIcon } from 'lucide-react';

interface PageTitleProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}

export function PageTitle({ icon: Icon, title, subtitle }: PageTitleProps) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="rounded-2xl bg-gradient-to-br from-aviation-50 to-aviation-100 p-2 shadow-sm dark:from-aviation-900/30 dark:to-aviation-800/20">
        <Icon className="h-6 w-6 text-aviation-600 dark:text-aviation-400" />
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-graphite-900 dark:text-graphite-100">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-graphite-500 dark:text-graphite-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
