import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Route,
  Network,
  BarChart3,
  Cloud,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  Navigation,
  X
} from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import type { UserRole } from '../types';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  permission?: string;
  roles?: UserRole[];
}

export const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    permission: 'dashboard:read',
    roles: ['ADMIN', 'DISPATCHER', 'VIEWER'],
  },
  {
    name: 'Delivery Management',
    path: '/deliveries',
    icon: Truck,
    permission: 'deliveries:read',
    roles: ['DISPATCHER'],
  },
  {
    name: 'Route Planner',
    path: '/route-planner',
    icon: Route,
    permission: 'routes:read',
    roles: ['DISPATCHER'],
  },
  {
    name: 'Delivery Zones',
    path: '/delivery-zones',
    icon: Network,
    permission: 'zones:read',
    roles: ['DISPATCHER'],
  },
  {
    name: 'Analytics',
    path: '/analytics',
    icon: BarChart3,
    permission: 'analytics:read',
    roles: ['ADMIN', 'DISPATCHER'],
  },
  {
    name: 'System Status',
    path: '/system-status',
    icon: Cloud,
    permission: 'system:read',
    roles: ['ADMIN'],
  },
  {
    name: 'Reports',
    path: '/reports',
    icon: FileSpreadsheet,
    roles: ['ADMIN', 'DISPATCHER', 'VIEWER'],
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: Settings,
    permission: 'profile:self',
    roles: ['ADMIN', 'DISPATCHER', 'VIEWER'],
  },
];

export function canAccess(role: UserRole | null | undefined, path: string): boolean {
  if (!role) return false;
  const normalizedRole = role.toUpperCase() as UserRole;
  if (path === '/' || path === '/settings') {
    return true;
  }
  if (path === '/reports') {
    return true;
  }
  if (path === '/deliveries' || path === '/route-planner' || path === '/delivery-zones') {
    return normalizedRole === 'DISPATCHER';
  }
  if (path === '/analytics') {
    return normalizedRole === 'ADMIN' || normalizedRole === 'DISPATCHER';
  }
  if (path === '/system-status' || path === '/cloud-management' || path === '/cloud') {
    return normalizedRole === 'ADMIN';
  }
  return false;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { role, can } = useAuth();
  const visibleNavItems = navItems.filter((item) => {
    if (item.path === '/reports') {
      return can('reports:operational') || can('reports:analytics') || can('reports:system') || can('reports:my_parcels') || canAccess(role, item.path);
    }
    if (item.permission) {
      return can(item.permission);
    }
    return canAccess(role, item.path);
  });
  return (
    <>
      {/* Mobile backdrop with blur */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar Container */}
      <aside
        aria-label="Application navigation"
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col glass-chrome border-r transition-all duration-300 ease-in-out lg:static
          ${collapsed ? 'w-20' : 'w-64'}
          ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/20">
              <Navigation className="h-5 w-5 rotate-45 transform" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                  SmartRoute<span className="text-brand-600 dark:text-brand-400">Pro</span>
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tracking-tight">
                  Logistics & Route Suite
                </span>
              </div>
            )}
          </div>

          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="flex lg:hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Items (8 Main Tabs) */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 focus:outline-none">
          <div className={`px-2.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${collapsed ? 'text-center' : ''}`}>
            {collapsed ? '•••' : 'Navigation'}
          </div>

          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                title={collapsed ? item.name : undefined}
                className={({ isActive }) => `
                  group relative flex items-center rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900
                  ${collapsed ? 'justify-center' : 'justify-between'}
                  ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-sm shadow-brand-600/25 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }
                `}
              >
                {({ isActive }) => (
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100'
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
