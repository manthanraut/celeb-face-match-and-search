import { Link, NavLink, Outlet } from "react-router-dom";

const navigationItems = [
  { label: "Gallery", to: "/galleries/met-gala-2026" },
  { label: "Discover", to: "/discover" },
  { label: "Admin", to: "/admin" },
] as const;

export function VersoLayout() {
  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <a
        className="fixed left-4 top-4 z-50 -translate-y-24 bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition-transform focus:translate-y-0 motion-reduce:transition-none"
        href="#verso-main-content"
      >
        Skip to Content
      </a>
      <header className="border-b border-neutral-300 bg-white">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-6 px-5 py-3 sm:px-8">
          <Link
            aria-label="Vogue gallery home"
            className="font-editorial text-3xl leading-none tracking-[-0.07em] hover:text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950 sm:text-4xl"
            to="/galleries/met-gala-2026"
            translate="no"
          >
            VOGUE
          </Link>
          <nav aria-label="Primary navigation">
            <ul className="flex items-center gap-4 text-[0.65rem] font-bold uppercase tracking-[0.12em] sm:gap-6 sm:text-[0.7rem]">
              {navigationItems.map((item) => (
                <li className={item.label === "Gallery" ? "hidden sm:list-item" : "list-item"} key={item.to}>
                  <NavLink
                    className={({ isActive }) => {
                      const interactionStyles =
                        "hover:text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950";

                      return isActive
                        ? `${interactionStyles} underline decoration-2 underline-offset-4`
                        : interactionStyles;
                    }}
                    to={item.to}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="verso-main-content">
        <Outlet />
      </main>
    </div>
  );
}
