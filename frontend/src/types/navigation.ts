import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  path?: string;
  description?: string;
  children?: MenuItem[];
  adminOnly?: boolean;
  adminOrGsOnly?: boolean;
  arquivoOnly?: boolean;
  certificacoesOnly?: boolean;
  relatoriosOnly?: boolean;
  ptrBaRelatoriosOnly?: boolean;
}
