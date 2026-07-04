/** Small chip for an extracted entity (org / model / person). */
export function EntityChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] leading-tight text-muted">
      {label}
    </span>
  );
}
