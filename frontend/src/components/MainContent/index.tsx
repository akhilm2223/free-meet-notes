'use client';

import React from 'react';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';

interface MainContentProps {
  children: React.ReactNode;
}

const MainContent: React.FC<MainContentProps> = ({ children }) => {
  const { isCollapsed } = useSidebar();

  return (
    <main 
      className={`min-w-0 h-screen flex-1 overflow-hidden bg-[#f6f8fc] transition-[margin] duration-300 ${
        isCollapsed ? 'ml-[72px]' : 'ml-[272px]'
      }`}
    >
      <div className="h-full min-w-0">
        {children}
      </div>
    </main>
  );
};

export default MainContent;
