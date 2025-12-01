import { Outlet } from "react-router-dom";
import AppNavbar from "@/components/AppNavbar";
import Sidebar from "@/components/Sidebar";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";

interface AppLayoutProps {
  children?: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Load from localStorage on initial render
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });

  // Persist collapse state to localStorage
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 font-sans selection:bg-cyan-500/30 overflow-hidden">
      {/* Background Grid Effect */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-cyan-500 opacity-20 blur-[100px]"></div>
        <div className="absolute right-0 bottom-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-purple-500 opacity-20 blur-[100px]"></div>
      </div>

      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div 
        className={`flex-1 flex flex-col overflow-hidden relative z-10 transition-all duration-300 ${
          sidebarOpen
            ? sidebarCollapsed
              ? "md:ml-16"
              : "md:ml-72"
            : "md:ml-0"
        }`}
      >
        <AppNavbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto chatgpt-scrollbar">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
