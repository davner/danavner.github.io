import { useSearchParams } from "react-router";

import { PageHeader, PageShell } from "@/components/page";
import { PostCard } from "@/components/post-card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CATEGORIES, CATEGORY_LABEL, posts, postsByCategory, type Category } from "@/lib/blog";
import { cn } from "@/lib/utils";
import { useDocumentMeta } from "@/lib/use-document-meta";

type Filter = Category | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everything" },
  ...CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABEL[category] })),
];

function isFilter(value: string | null): value is Filter {
  return value === "all" || CATEGORIES.includes(value as Category);
}

export function Writing() {
  useDocumentMeta(
    "Writing",
    "Posts on scientific software and engineering, plus the personal stuff. Filter by work or personal.",
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
        eyebrow="Writing"
        title="Notes"
        meta={[`${posts.length} ${posts.length === 1 ? "post" : "posts"}`, "No schedule"]}
        lede="Some of this is about building software for astronomy. Some of it is about lifting, drums, or whatever else has my attention. It all lives here — filter it if you only want one kind."
      >
        {/* A single-select filter is a radio group, which is what ToggleGroup
            gives: roving focus and arrow-key navigation for free. */}
        <ToggleGroup
          type="single"
          value={active}
          onValueChange={(value) => selectFilter(isFilter(value) ? value : "all")}
          aria-label="Filter posts by category"
          className="mt-8 max-w-full flex-wrap bg-border"
        >
          {FILTERS.map((filter) => {
            const count =
              filter.value === "all" ? posts.length : postsByCategory(filter.value).length;

            return (
              <ToggleGroupItem
                key={filter.value}
                value={filter.value}
                className={cn(
                  "h-auto gap-2 bg-background px-5 py-3 text-muted-foreground",
                  "hover:bg-background hover:text-ember",
                  "data-[state=on]:bg-ember data-[state=on]:text-primary-foreground",
                )}
              >
                <span className="readout">{filter.label}</span>
                <span className="font-mono text-[0.65rem] opacity-70">{count}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </PageHeader>

      {visible.length > 0 ? (
        <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
          {visible.map((post, index) => (
            <PostCard key={post.slug} post={post} index={visible.length - index} />
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
