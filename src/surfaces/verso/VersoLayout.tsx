import { Link, Outlet } from "react-router-dom";

const navigationItems = [
  { label: "Gallery", to: "/galleries/met-gala-2026" },
  { label: "Discover", to: "/discover?q=search_result" },
  { label: "Bookmarks", to: "/bookmarks" },
] as const;

export function VersoLayout() {
  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <a className="fixed left-4 top-4 z-50 -translate-y-24 bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition-transform focus:translate-y-0" href="#verso-main-content">
        Skip to Content
      </a>
      <header className="font-vogue-sans bg-white text-black">
        <div className="flex h-11 items-center justify-center border-y border-[#e3e3e3] text-[0.8rem] tracking-[-0.01em]">
          <span>Your All Access Pass</span>
          <Link className="ml-6 font-medium uppercase hover:underline" to="/bookmarks">Get the app</Link>
        </div>
        <div className="relative flex h-[3.6rem] items-center border-b border-[#dedede] px-3 sm:px-5">
          <Link className="hidden bg-black px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.13em] text-white transition hover:bg-neutral-700 sm:block" to="/bookmarks">Become a member</Link>
          <Link aria-label="Vogue home" className="font-editorial absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[2.7rem] leading-none tracking-[-0.075em] hover:text-neutral-600" to="/discover?q=search_result" translate="no">VOGUE</Link>
          <div className="ml-auto flex items-center gap-4 sm:gap-5">
            <Link aria-label="Search" className="hidden size-7 items-center justify-center sm:flex" to="/discover?q=search_result"><svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="1.4"/></svg></Link>
            <Link className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] hover:text-neutral-500" to="/admin"><svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="7.5" r="3.5" stroke="currentColor" strokeWidth="1.4"/><path d="M6 20c0-4 2.4-6.5 6-6.5s6 2.5 6 6.5" stroke="currentColor" strokeWidth="1.4"/></svg><span className="hidden lg:inline">Sign in</span></Link>
            <button aria-label="Open menu" className="flex items-center gap-3 text-[0.72rem] font-semibold uppercase tracking-[0.14em]" type="button"><span className="hidden sm:inline">Menu</span><span className="flex size-7 flex-col items-center justify-center gap-[5px]"><span className="h-px w-5 bg-black"/><span className="h-px w-5 bg-black"/><span className="h-px w-5 bg-black"/></span></button>
          </div>
        </div>
        <nav aria-label="Primary navigation" className="flex h-[2.65rem] items-center justify-center border-b border-[#dedede] px-4">
          <ul className="flex items-center gap-8 text-[0.72rem] font-semibold uppercase tracking-[0.14em] sm:gap-12">{navigationItems.map((item) => <li key={item.label}><Link className="whitespace-nowrap hover:text-neutral-500" to={item.to}>{item.label}</Link></li>)}</ul>
        </nav>
      </header>
      <main id="verso-main-content"><Outlet /></main>
    </div>
  );
}
