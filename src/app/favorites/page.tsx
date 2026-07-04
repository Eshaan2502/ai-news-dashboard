import { getFeed, getSources, getTopics } from "@/lib/db/queries";
import { getCurrentUserId } from "@/lib/db/user";
import { FeedView } from "@/components/FeedView";
import { SetupNotice } from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  try {
    const userId = await getCurrentUserId();
    const [items, sources, topics] = await Promise.all([
      getFeed({ userId, favoritesOnly: true, includeDuplicates: true, sort: "date" }),
      getSources(),
      getTopics(),
    ]);

    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Favorites</h1>
          <p className="mt-1 text-sm text-muted">
            Your saved stories — broadcast them to Email, LinkedIn, WhatsApp and more.
          </p>
        </header>
        <FeedView initialItems={items} sources={sources} topics={topics} favoritesOnly />
      </div>
    );
  } catch (err) {
    return <SetupNotice error={err instanceof Error ? err.message : String(err)} />;
  }
}
