import { requireUser } from "@/lib/db/user";
import { TopicPicker } from "@/components/TopicPicker";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="text-center">
        <h1 className="font-serif text-3xl font-black tracking-tight text-foreground">Your topics</h1>
        <p className="mt-2 text-sm text-muted">
          Reorder or swap topics — the priority order drives your front page.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {user.isGuest
            ? "Browsing as a guest — preferences are saved to this device."
            : `Signed in as ${user.email}`}
        </p>
      </header>
      <TopicPicker initialSelected={user.preferredTopics ?? []} submitLabel="Save changes" />
    </div>
  );
}
