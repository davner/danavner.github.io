import { useSearchParams } from "react-router";

import { EmptyState } from "@/components/empty-state";
import { FilterStatus } from "@/components/filter-status";
import { FilterToggle } from "@/components/filter-toggle";
import { PageHeader, PageShell } from "@/components/page";
import { PostCard } from "@/components/post-card";
import { CATEGORIES, CATEGORY_LABEL, posts, postsByCategory, type Category } from "@/lib/blog";
import { catalogueLine, PAGE_META } from "@/lib/routes";
import { useDocumentMeta } from "@/lib/use-document-meta";

const META = PAGE_META["/blog"];

type Filter = Category | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everything" },
  ...CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABEL[category] })),
];

function isFilter(value: string | null): value is Filter {
  return value === "all" || CATEGORIES.includes(value as Category);
}

export function Blog() {
  useDocumentMeta(META.title, META.description);

  // Kept in the URL so a filtered view is linkable and survives a refresh.
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("category");
  const active: Filter = isFilter(raw) ? raw : "all";
  const visible = postsByCategory(active);

  function selectFilter(value: Filter) {
    setSearchParams(value === "all" ? {} : { category: value }, { replace: true });
  }

  return (
    <PageShell>
      <PageHeader
        catalogue={catalogueLine("/blog")}
        title={
          <>
            <span className="block">Notes on</span>
            <span className="display-outline block">whatever</span>
          </>
        }
        lede="Some of this is about building software for astronomy. The rest is about records, lifting, or whatever else has my attention that week. It all lives in one place, so filter it if you only want one kind."
      >
        <FilterToggle
          label="Filter posts by category"
          value={active}
          onChange={selectFilter}
          className="mt-8"
          options={FILTERS.map((filter) => ({
            value: filter.value,
            label: filter.label,
            count: filter.value === "all" ? posts.length : postsByCategory(filter.value).length,
          }))}
        />
      </PageHeader>

      {/* What the category pills above just did, for a reader who cannot see the
          grid change under them. Rendered unconditionally, and on the empty
          result too - none of them is the answer to what was asked. */}
      <FilterStatus message={`${visible.length} of ${posts.length} posts shown`} />

      <section aria-labelledby="posts">
        {/* Every card title below is an `h3`, so this is what the outline has
            to say they are. `sr-only` because the filter above it already
            tells a sighted reader what the grid is. */}
        <h2 id="posts" className="sr-only">
          The posts
        </h2>

        {visible.length > 0 ? (
          <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
            {visible.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <EmptyState>Nothing here yet. Check back soon.</EmptyState>
        )}
      </section>
    </PageShell>
  );
}
