import type { AppId } from '../window-manager/types';
import type { LucideIcon } from 'lucide-react';

export interface AppDefinition {
  id: AppId;
  name: string;
  description: string;
  icon: LucideIcon;
  defaultBounds: { x: number; y: number; width: number; height: number };
  category: 'web' | 'utility' | 'system';
}
