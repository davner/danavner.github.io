import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { Backdrop } from "@/components/backdrop";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { About } from "@/routes/about";
import { Home } from "@/routes/home";
import { NotFound } from "@/routes/not-found";
import { Work } from "@/routes/work";
import { Writing } from "@/routes/writing";

// The markdown renderer and syntax highlighter are only needed on a post page,
// and together they outweigh the rest of the site — so they load on demand.
const WritingPost = lazy(() =>
  import("@/routes/writing-post").then((module) => ({ default: module.WritingPost })),
);

// Shows render markdown notes, so this route pulls in the renderer too.
const Shows = lazy(() => import("@/routes/shows").then((module) => ({ default: module.Shows })));

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Backdrop />

      <a
        href="#main"
        className="readout sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:bg-ember focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <div className="flex min-h-dvh flex-col">
        <SiteHeader />

        <main id="main" className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/work" element={<Work />} />
            <Route path="/about" element={<About />} />
            <Route
              path="/shows"
              element={
                <Suspense fallback={<PostSkeleton />}>
                  <Shows />
                </Suspense>
              }
            />
            <Route path="/writing" element={<Writing />} />
            <Route
              path="/writing/:slug"
              element={
                <Suspense fallback={<PostSkeleton />}>
                  <WritingPost />
                </Suspense>
              }
            />
            {/* Kept so older /blog links keep resolving. */}
            <Route path="/blog" element={<Navigate to="/writing" replace />} />
            <Route path="/blog/:slug" element={<LegacyPostRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <SiteFooter />
      </div>
    </BrowserRouter>
  );
}

function LegacyPostRedirect() {
  return <Navigate to="/writing" replace />;
}

function PostSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-4 py-16 sm:px-6 sm:py-20" aria-hidden>
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="mt-8 h-5 w-56 rounded bg-muted" />
      <div className="mt-5 h-11 w-full rounded bg-muted" />
      <div className="mt-3 h-11 w-2/3 rounded bg-muted" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-4 rounded bg-muted" style={{ width: `${95 - index * 4}%` }} />
        ))}
      </div>
    </div>
  );
}
