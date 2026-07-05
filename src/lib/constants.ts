export const SORT_OPTIONS = [
  { value: "date", label: "Newest" },
  { value: "impact", label: "Impact" },
  { value: "source", label: "Source" },
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number]["value"];
