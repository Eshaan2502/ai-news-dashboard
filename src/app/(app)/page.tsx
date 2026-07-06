import { getFeed, getTrending, type FeedItemDTO } from "@/lib/db/queries";
import { requireOnboardedUser } from "@/lib/db/user";
import { SearchSection } from "@/components/SearchSection";
import { TopicSection } from "@/components/TopicSection";
import { SetupNotice } from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

/**
 * The Spectrum front page: a search bar, a Trending strip (the stories most
 * outlets are talking about right now — ranked by cluster coverage over the
 * last 48h), then one row per chosen topic — in the user's priority order.
 * An active search adds a results row above Trending.
 */
export default async function HomePage() {
  const user = await requireOnboardedUser();
  const topics = user.preferredTopics ?? [];

  let trending: FeedItemDTO[];
  let topicRows: FeedItemDTO[][];
  try {
    [trending, ...topicRows] = await Promise.all([
      getTrending({ userId: user.id, days: 2, limit: 12 }),
      ...topics.map((topic) => getFeed({ userId: user.id, topic, sort: "date", limit: 10 })),
    ]);
  } catch (err) {
    return <SetupNotice error={err instanceof Error ? err.message : String(err)} />;
  }

  return (
    <div className="space-y-10">
      <SearchSection />
      <TopicSection title="Trending" items={trending} trending />
      {topics.map((topic, i) => (
        <TopicSection key={topic} title={topic} items={topicRows[i]} />
      ))}
    </div>
  );
}
