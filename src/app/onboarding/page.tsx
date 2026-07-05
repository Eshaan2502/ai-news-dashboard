import { redirect } from "next/navigation";
import { requireUser } from "@/lib/db/user";
import { TopicPicker } from "@/components/TopicPicker";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.preferredTopics?.length) redirect("/");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14">
      <header className="mb-10 text-center">
        <h1 className="font-serif text-4xl font-black tracking-tight text-foreground">
          Choose your spectrum
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          Pick the topics you care about — the order you pick them is the order they appear on
          your front page. You can change this anytime.
        </p>
      </header>
      <TopicPicker />
    </main>
  );
}
