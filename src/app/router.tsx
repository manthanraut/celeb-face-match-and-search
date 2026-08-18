import { createBrowserRouter, Navigate } from "react-router-dom";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { CopilotLayout } from "../surfaces/copilot/CopilotLayout";
import { VersoLayout } from "../surfaces/verso/VersoLayout";

export const router = createBrowserRouter([
  {
    path: "/admin",
    element: <CopilotLayout />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { DashboardPage } = await import(
            "../surfaces/copilot/pages/DashboardPage/DashboardPage"
          );

          return { Component: DashboardPage };
        },
      },
      {
        path: "photos",
        lazy: async () => {
          const { PhotoLibraryPage } = await import(
            "../surfaces/copilot/pages/PhotoLibraryPage/PhotoLibraryPage"
          );

          return { Component: PhotoLibraryPage };
        },
      },
      {
        path: "photos/new",
        lazy: async () => {
          const { PhotoUploadPage } = await import(
            "../surfaces/copilot/pages/PhotoUploadPage/PhotoUploadPage"
          );

          return { Component: PhotoUploadPage };
        },
      },
      {
        path: "photos/:assetId",
        lazy: async () => {
          const { PhotoDetailPage } = await import(
            "../surfaces/copilot/pages/PhotoDetailPage/PhotoDetailPage"
          );

          return { Component: PhotoDetailPage };
        },
      },
      {
        path: "*",
        element: (
          <PagePlaceholder
            description="The requested Copilot page does not exist."
            title="Page Not Found"
          />
        ),
      },
    ],
  },
  {
    path: "/",
    element: <VersoLayout />,
    children: [
      {
        index: true,
        element: <Navigate replace to="/galleries/met-gala-2026" />,
      },
      {
        path: "galleries/met-gala-2026",
        lazy: async () => {
          const { GalleryPage } = await import(
            "../surfaces/verso/pages/GalleryPage/GalleryPage"
          );

          return { Component: GalleryPage };
        },
      },
      {
        path: "discover",
        lazy: async () => {
          const { DiscoverPage } = await import(
            "../surfaces/verso/pages/DiscoverPage/DiscoverPage"
          );

          return { Component: DiscoverPage };
        },
      },
      {
        path: "celebrities/:celebritySlug",
        lazy: async () => {
          const { CelebrityPage } = await import(
            "../surfaces/verso/pages/CelebrityPage/CelebrityPage"
          );

          return { Component: CelebrityPage };
        },
      },
      {
        path: "bookmarks",
        lazy: async () => {
          const { BookmarksPage } = await import(
            "../surfaces/verso/pages/BookmarksPage/BookmarksPage"
          );

          return { Component: BookmarksPage };
        },
      },
      {
        path: "*",
        element: (
          <PagePlaceholder
            description="The requested page does not exist."
            title="Page Not Found"
          />
        ),
      },
    ],
  },
]);
