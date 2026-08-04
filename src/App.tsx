import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router";

import { Backdrop } from "@/components/backdrop";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { About } from "@/routes/about";
import { Blog } from "@/routes/blog";
import { Career } from "@/routes/career";
import { Home } from "@/routes/home";
import { NotFound } from "@/routes/not-found";

// The markdown renderer and syntax highlighter are only needed on a post page,
// and together they outweigh the rest of the site - so they load on demand.
const BlogPost = lazy(() =>
  import("@/routes/blog-post").then((module) => ({ default: module.BlogPost })),
);

// Shows render markdown notes, so these routes pull in the renderer too.
const Shows = lazy(() => import("@/routes/shows").then((module) => ({ default: module.Shows })));
const ShowDetail = lazy(() =>
  import("@/routes/show").then((module) => ({ default: module.ShowDetail })),
);

// Trips render markdown notes as well, so they load on demand for the same
// reason the show pages do.
const Trips = lazy(() => import("@/routes/trips").then((module) => ({ default: module.Trips })));
const TripDetail = lazy(() =>
  import("@/routes/trip").then((module) => ({ default: module.TripDetail })),
);

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
            <Route path="/about" element={<About />} />
            <Route path="/career" element={<Career />} />
            <Route path="/blog" element={<Blog />} />
            <Route
              path="/blog/:slug"
              element={
                <Suspense fallback={<PostSkeleton />}>
                  <BlogPost />
                </Suspense>
              }
            />
            <Route
              path="/shows"
              element={
                <Suspense fallback={<PostSkeleton />}>
                  <Shows />
                </Suspense>
              }
            />
            <Route
              path="/shows/:slug"
              element={
                <Suspense fallback={<PostSkeleton />}>
                  <ShowDetail />
                </Suspense>
              }
            />
            <Route
              path="/trips"
              element={
                <Suspense fallback={<PostSkeleton />}>
                  <Trips />
                </Suspense>
              }
            />
            <Route
              path="/trips/:slug"
              element={
                <Suspense fallback={<PostSkeleton />}>
                  <TripDetail />
                </Suspense>
              }
            />

            {/* The sections were called Work and Writing before; keep both
                resolving so nothing already linked breaks. */}
            <Route path="/work" element={<Navigate to="/career" replace />} />
            <Route path="/writing" element={<Navigate to="/blog" replace />} />
            <Route path="/writing/:slug" element={<LegacyPostRedirect />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <SiteFooter />
      </div>
    </BrowserRouter>
  );
}

function LegacyPostRedirect() {
  const { slug } = useParams();
  return <Navigate to={slug ? `/blog/${slug}` : "/blog"} replace />;
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
