import { categoryColor } from "@/lib/ui";

/** Source name with a category-colored dot. */
export function SourceTag({ name, category }: { name: string | null; category?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/90">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: categoryColor(category) }}
      />
      {name ?? "Unknown"}
    </span>
  );
}
