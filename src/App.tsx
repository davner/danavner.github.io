import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router";

import { Backdrop } from "@/components/backdrop";
import { RouteBoundary } from "@/components/route-boundary";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { About } from "@/routes/about";
import { Blog } from "@/routes/blog";
import { Career } from "@/routes/career";
import { Colophon } from "@/routes/colophon";
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

// The record collection is a page of its own with a cover grid and a stat
// board, and nothing else needs it, so it loads on demand too.
const Vinyl = lazy(() => import("@/routes/vinyl").then((module) => ({ default: module.Vinyl })));

// The now page renders markdown, so it pulls in the renderer as well. One
// `lazy` and one component for both `/now` and `/now/:date`: `/now/<current>`
// redirects to `/now`, which is the commonest path a shared link takes, and
// `React.lazy` caches per component identity rather than per module - so a
// second `lazy()` on the same specifier would suspend a second time after the
// redirect and flash the skeleton twice on the happy path.
const Now = lazy(() => import("@/routes/now").then((module) => ({ default: module.Now })));

// The comics page is a cover grid of its own, loaded on demand like the records.
const Comics = lazy(() => import("@/routes/comics").then((module) => ({ default: module.Comics })));

const Fortnite = lazy(() =>
  import("@/routes/fortnite").then((module) => ({ default: module.Fortnite })),
);

// The album log is a page of its own with a cover and a score board, loaded on
// demand like the rest of the collections.
const DanFm = lazy(() => import("@/routes/dan-fm").then((module) => ({ default: module.DanFm })));

// One album's own page, which is what every shared dan.fm link opens. Its own
// chunk rather than the station's: the two render the same record but nothing
// arriving at one needs the other.
const DanFmAlbum = lazy(() =>
  import("@/routes/dan-fm-album").then((module) => ({ default: module.DanFmAlbum })),
);

export function App() {
  // Hoisted so both now routes share one element, and with it one lazy
  // identity - see the `Now` import above.
  const nowRoute = (
    <RouteBoundary>
      <Suspense fallback={<PostSkeleton />}>
        <Now />
      </Suspense>
    </RouteBoundary>
  );

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
                <RouteBoundary>
                  <Suspense fallback={<PostSkeleton />}>
                    <BlogPost />
                  </Suspense>
                </RouteBoundary>
              }
            />
            <Route
              path="/shows"
              element={
                <RouteBoundary>
                  <Suspense fallback={<PostSkeleton />}>
                    <Shows />
                  </Suspense>
                </RouteBoundary>
              }
            />
            <Route
              path="/shows/:slug"
              element={
                <RouteBoundary>
                  <Suspense fallback={<PostSkeleton />}>
                    <ShowDetail />
                  </Suspense>
                </RouteBoundary>
              }
            />
            <Route
              path="/vinyl"
              element={
                <RouteBoundary>
                  <Suspense fallback={<PostSkeleton />}>
                    <Vinyl />
                  </Suspense>
                </RouteBoundary>
              }
            />
            <Route path="/now" element={nowRoute} />
            <Route path="/now/:date" element={nowRoute} />
            <Route
              path="/comics"
              element={
                <RouteBoundary>
                  <Suspense fallback={<PostSkeleton />}>
                    <Comics />
                  </Suspense>
                </RouteBoundary>
              }
            />
            <Route
              path="/fortnite"
              element={
                <RouteBoundary>
                  <Suspense fallback={<PostSkeleton />}>
                    <Fortnite />
                  </Suspense>
                </RouteBoundary>
              }
            />
            <Route
              path="/dan-fm"
              element={
                <RouteBoundary>
                  <Suspense fallback={<PostSkeleton />}>
                    <DanFm />
                  </Suspense>
                </RouteBoundary>
              }
            />
            <Route
              path="/dan-fm/:slug"
              element={
                <RouteBoundary>
                  <Suspense fallback={<PostSkeleton />}>
                    <DanFmAlbum />
                  </Suspense>
                </RouteBoundary>
              }
            />

            {/* The page about the site rather than a section of it, so the
                footer's imprint links it and the nav does not. */}
            <Route path="/colophon" element={<Colophon />} />

            {/* Links in the wild still point at /work, /writing and /trips; keep
                them resolving so nothing already linked breaks. The travel
                writing lives in the blog, so /trips lands there rather than on
                the 404. */}
            <Route path="/work" element={<Navigate to="/career" replace />} />
            <Route path="/writing" element={<Navigate to="/blog" replace />} />
            <Route path="/writing/:slug" element={<LegacyPostRedirect />} />
            <Route path="/trips" element={<Navigate to="/blog" replace />} />
            <Route path="/trips/:slug" element={<Navigate to="/blog" replace />} />

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

/**
 * Stands in for a lazily-loaded route while its chunk arrives. Roughly the shape
 * of a page: a kicker, a title over two lines, then prose.
 *
 * `min-h-dvh` is what keeps the footer off the screen until the page is real.
 * The shell above is a column with `main` on `flex-1`, so a fallback shorter
 * than the viewport parks the footer at the bottom of the fold and then drops
 * it the moment the chunk lands - a layout shift on every lazy route.
 *
 * Three things this must never grow, each of them counted somewhere else: an
 * `h1`, which every wait on a page title would resolve against; a
 * `role="status"`, which the shelf's live region is the only one of; and
 * `inert` or `data-aria-hidden`, which `lib/inert-behind-overlay.ts` owns
 * outright and reports anything else wearing.
 */
function PostSkeleton() {
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-16 sm:px-6 sm:py-20" aria-hidden>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-8 h-5 w-56" />
      <Skeleton className="mt-5 h-11 w-full" />
      <Skeleton className="mt-3 h-11 w-2/3" />

      {/* Two paragraphs, because the box around them is a viewport tall. One
          block of lines fills two thirds of that and leaves the rest blank,
          which reads as a page that failed rather than one still arriving.

          The second is shorter and cut to its own widths: two blocks ragged the
          same way read as one shape stamped twice, which is the giveaway that
          none of it is text. */}
      {[
        { lines: 8, start: 95 },
        { lines: 6, start: 93 },
      ].map(({ lines, start }) => (
        // `gap` rather than `space-y`, so the stack does not depend on which
        // child happens to be first.
        <div key={start} className="mt-10 flex flex-col gap-3">
          {Array.from({ length: lines }, (_, index) => (
            <Skeleton key={index} className="h-4" style={{ width: `${start - index * 4}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
