import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-aviation-500/50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';

  const variants = {
    primary:
      'bg-gradient-to-r from-aviation-600 to-aviation-700 text-white shadow-lg shadow-aviation-500/20 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 dark:from-aviation-500 dark:to-aviation-600',
    secondary:
      'bg-white/80 text-graphite-700 border border-graphite-200/60 hover:bg-graphite-50 hover:border-graphite-300 dark:bg-surface-card/80 dark:text-graphite-200 dark:border-border-dark dark:hover:bg-surface-hover/50 dark:hover:border-graphite-600',
    ghost:
      'text-graphite-600 hover:bg-graphite-100 dark:text-graphite-400 dark:hover:bg-surface-hover/80',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
