import { Outlet } from "react-router-dom";

import { AdminHeader } from "./components/AdminHeader";

export function CopilotLayout() {
  return (
    <div className="min-h-screen bg-[#f5f5f5] text-neutral-950">
      <a
        className="fixed left-4 top-4 z-50 -translate-y-24 bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition-transform focus:translate-y-0 motion-reduce:transition-none"
        href="#copilot-main-content"
      >
        Skip to Content
      </a>
      <AdminHeader />
      <main id="copilot-main-content">
        <Outlet />
      </main>
    </div>
  );
}
