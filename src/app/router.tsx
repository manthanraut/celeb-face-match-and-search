import { createBrowserRouter, Link, Navigate, NavLink, Outlet } from "react-router-dom";

import { GalleryPage } from "../pages/GalleryPage/GalleryPage";
import { PagePlaceholder } from "../pages/PagePlaceholder";

const navigationItems = [
  { label: "Gallery", to: "/galleries/met-gala-2026" },
  { label: "Discover", to: "/discover" },
  { label: "Bookmarks", to: "/bookmarks" },
  { label: "Admin", to: "/admin" },
] as const;

function RootLayout() {
  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <a
        className="fixed left-4 top-4 z-50 -translate-y-24 bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition-transform focus:translate-y-0 motion-reduce:transition-none"
        href="#main-content"
      >
        Skip to Content
      </a>
      <header className="border-b border-neutral-300 bg-white">
        <div className="mx-auto flex max-w-[100rem] items-center justify-between gap-6 px-5 py-4 sm:px-8">
          <Link
            aria-label="Vogue gallery home"
            className="font-editorial text-4xl leading-none tracking-[-0.07em] hover:text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950 sm:text-5xl"
            to="/galleries/met-gala-2026"
            translate="no"
          >
            VOGUE
          </Link>
          <nav aria-label="Primary navigation">
            <ul className="flex items-center gap-4 text-[0.7rem] font-bold uppercase tracking-[0.12em] sm:gap-6 sm:text-xs">
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
      <main id="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Navigate replace to="/galleries/met-gala-2026" />,
      },
      {
        path: "galleries/met-gala-2026",
        element: <GalleryPage />,
      },
      {
        path: "discover",
        element: (
          <PagePlaceholder
            description="Search, celebrity suggestions, filters and image results will live here."
            title="Discover"
          />
        ),
      },
      {
        path: "celebrities/:celebritySlug",
        element: (
          <PagePlaceholder
            description="A dedicated archive for a celebrity's images and related content."
            title="Celebrity archive"
          />
        ),
      },
      {
        path: "bookmarks",
        element: (
          <PagePlaceholder
            description="Locally saved images will be displayed here."
            title="My bookmarks"
          />
        ),
      },
      {
        path: "admin",
        element: (
          <PagePlaceholder
            description="The entry point for the internal photo workflow."
            title="Admin dashboard"
          />
        ),
      },
      {
        path: "admin/photos",
        element: (
          <PagePlaceholder
            description="Uploaded and processed photo assets will be listed here."
            title="Photo library"
          />
        ),
      },
      {
        path: "admin/photos/new",
        element: (
          <PagePlaceholder
            description="Editors will upload metadata and submit images for recognition here."
            title="Upload photo"
          />
        ),
      },
      {
        path: "admin/photos/:assetId",
        element: (
          <PagePlaceholder
            description="Photo metadata and normalized recognition results will be displayed here."
            title="Photo details"
          />
        ),
      },
      {
        path: "*",
        element: (
          <PagePlaceholder
            description="The requested page does not exist."
            title="Page not found"
          />
        ),
      },
    ],
  },
]);
