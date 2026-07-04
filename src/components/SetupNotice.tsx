import { Database, Terminal } from "lucide-react";

/** Shown when the database can't be reached — guides first-time setup. */
export function SetupNotice({ error }: { error?: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-foreground">
        <Database className="h-5 w-5 text-primary" />
        <h1 className="text-base font-semibold">Database not ready</h1>
      </div>
      <p className="mt-2 text-sm text-muted">
        The dashboard can&apos;t reach Postgres yet. Set <code className="text-foreground">DATABASE_URL</code>{" "}
        in <code className="text-foreground">.env</code>, then run migrations and the seed:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-surface p-3 text-xs text-foreground">
        <span className="text-muted-foreground"># start a local pgvector Postgres (or use Supabase)</span>
        {"\n"}docker compose up -d db{"\n"}npm run db:migrate{"\n"}npm run db:seed
      </pre>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Terminal className="h-3.5 w-3.5" />
        Then reload this page.
      </p>
      {error && (
        <p className="mt-3 break-words rounded border border-border bg-surface p-2 text-[11px] text-muted-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
