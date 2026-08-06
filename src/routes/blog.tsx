import { useSearchParams } from "react-router";

import { FilterToggle } from "@/components/filter-toggle";
import { PageHeader, PageShell } from "@/components/page";
import { PostCard } from "@/components/post-card";
import { CATEGORIES, CATEGORY_LABEL, posts, postsByCategory, type Category } from "@/lib/blog";
import { useDocumentMeta } from "@/lib/use-document-meta";

type Filter = Category | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everything" },
  ...CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABEL[category] })),
];

function isFilter(value: string | null): value is Filter {
  return value === "all" || CATEGORIES.includes(value as Category);
}

export function Blog() {
  useDocumentMeta(
    "Blog",
    "Dan Avner's blog. Posts on scientific software and engineering, plus the personal stuff. Filter by work or personal.",
  );

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

      {visible.length > 0 ? (
        <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
          {visible.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <p className="border border-dashed border-border p-16 text-center text-muted-foreground">
          Nothing here yet. Check back soon.
        </p>
      )}
    </PageShell>
  );
}
