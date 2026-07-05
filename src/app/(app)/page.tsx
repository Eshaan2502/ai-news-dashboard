import { getFeed, type FeedItemDTO } from "@/lib/db/queries";
import { requireOnboardedUser } from "@/lib/db/user";
import { TopicSection } from "@/components/TopicSection";
import { SetupNotice } from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

/**
 * The Spectrum front page: a Trending strip (highest impact across every
 * topic, last 48h), then one row per chosen topic — in the user's priority
 * order.
 */
export default async function HomePage() {
  const user = await requireOnboardedUser();
  const topics = user.preferredTopics ?? [];

  let trending: FeedItemDTO[];
  let topicRows: FeedItemDTO[][];
  try {
    [trending, ...topicRows] = await Promise.all([
      getFeed({ userId: user.id, sort: "impact", days: 2, limit: 12 }),
      ...topics.map((topic) => getFeed({ userId: user.id, topic, sort: "date", limit: 10 })),
    ]);
  } catch (err) {
    return <SetupNotice error={err instanceof Error ? err.message : String(err)} />;
  }

  return (
    <div className="space-y-10">
      <TopicSection title="Trending" items={trending} trending />
      {topics.map((topic, i) => (
        <TopicSection key={topic} title={topic} items={topicRows[i]} />
      ))}
    </div>
  );
}
