import { type LucideIcon } from 'lucide-react';

interface EmptyCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyCard({ icon: Icon, title, description }: EmptyCardProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-aviation-50 to-aviation-100 p-4 shadow-sm dark:from-aviation-900/30 dark:to-aviation-800/20">
        <Icon className="h-10 w-10 text-aviation-600 dark:text-aviation-400" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-graphite-900 dark:text-graphite-100">
        {title}
      </h3>
      <p className="max-w-md text-sm text-graphite-400 dark:text-graphite-500">
        {description}
      </p>
    </div>
  );
}
