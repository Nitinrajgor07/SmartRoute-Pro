import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Navbar } from '../components/Navbar';

export const MainLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-backdrop min-h-screen flex flex-col antialiased transition-colors duration-200">
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Right Content Area */}
        <div className="flex flex-col flex-1 min-w-0 h-screen overflow-y-auto">
          {/* Top Navbar */}
          <Navbar onOpenMobile={() => setMobileMenuOpen(true)} />

          {/* Main Page Body */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
            <Outlet />
          </main>

          {/* Footer */}
          <footer className="glass-chrome border-t py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-center max-w-7xl mx-auto">
              <span className="font-semibold text-slate-700 dark:text-slate-300">SmartRoute Pro</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};
