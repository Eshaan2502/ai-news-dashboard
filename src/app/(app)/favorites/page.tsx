import { getFeed, type FeedItemDTO } from "@/lib/db/queries";
import { requireOnboardedUser } from "@/lib/db/user";
import { FavoritesGrid } from "@/components/FavoritesGrid";
import { SetupNotice } from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await requireOnboardedUser();

  let items: FeedItemDTO[];
  try {
    items = await getFeed({
      userId: user.id,
      favoritesOnly: true,
      includeDuplicates: true,
      sort: "date",
    });
  } catch (err) {
    return <SetupNotice error={err instanceof Error ? err.message : String(err)} />;
  }

  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="font-serif text-3xl font-black tracking-tight text-foreground">
          Saved stories
        </h1>
        <p className="mt-2 text-sm text-muted">Everything you starred, newest first.</p>
      </header>
      <FavoritesGrid initialItems={items} />
    </div>
  );
}
