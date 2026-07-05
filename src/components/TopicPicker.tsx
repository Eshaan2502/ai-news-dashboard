"use client";

import { useState, useTransition } from "react";
import { ArrowUp, ArrowDown, X, Check } from "lucide-react";
import { TOPICS, TOPIC_COLOR, TOPIC_BLURB, type Topic } from "@/lib/topics";
import { savePreferences } from "@/app/welcome/actions";
import { useToast } from "./ui/Toast";
import { cn } from "@/lib/utils";

/**
 * Topic selection with priority ordering. Click order IS the initial
 * priority (numbered badges); the list below fine-tunes with up/down.
 * Used by both onboarding and settings.
 */
export function TopicPicker({
  initialSelected = [],
  submitLabel = "Build my front page",
}: {
  initialSelected?: string[];
  submitLabel?: string;
}) {
  const [selected, setSelected] = useState<Topic[]>(
    initialSelected.filter((t): t is Topic => (TOPICS as readonly string[]).includes(t)),
  );
  const [saving, startSaving] = useTransition();
  const { toast } = useToast();

  const toggle = (topic: Topic) =>
    setSelected((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );

  const move = (index: number, dir: -1 | 1) =>
    setSelected((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const submit = () =>
    startSaving(async () => {
      try {
        await savePreferences(selected);
      } catch (err) {
        // Server redirect()s on success — anything caught here is a real error.
        if (err && typeof err === "object" && "digest" in err) throw err;
        toast({ title: "Couldn't save your topics", description: "Please try again.", variant: "error" });
      }
    });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TOPICS.map((topic) => {
          const rank = selected.indexOf(topic);
          const isOn = rank >= 0;
          return (
            <button
              key={topic}
              type="button"
              onClick={() => toggle(topic)}
              aria-pressed={isOn}
              className={cn(
                "relative flex min-h-28 flex-col justify-between rounded-lg border p-3 text-left shadow-sm transition-all",
                isOn
                  ? "border-border-strong bg-card -translate-y-0.5 shadow-md"
                  : "border-border bg-card/60 hover:bg-card",
              )}
              style={isOn ? { borderColor: TOPIC_COLOR[topic] } : undefined}
            >
              <span
                className={cn(
                  "absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-xs font-bold",
                  isOn ? "text-white" : "border border-border text-transparent",
                )}
                style={isOn ? { backgroundColor: TOPIC_COLOR[topic] } : undefined}
              >
                {isOn ? rank + 1 : "·"}
              </span>
              <span className="pr-7 font-serif text-base font-bold leading-tight" style={{ color: TOPIC_COLOR[topic] }}>
                {topic}
              </span>
              <span className="mt-2 text-[11px] leading-snug text-muted-foreground">
                {TOPIC_BLURB[topic]}
              </span>
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="mx-auto max-w-md space-y-2">
          <p className="text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Your front page, top to bottom
          </p>
          <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {selected.map((topic, i) => (
              <li key={topic} className="flex items-center gap-3 px-3 py-2">
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: TOPIC_COLOR[topic] }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{topic}</span>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${topic} up`}
                  className="grid h-7 w-7 place-items-center rounded text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === selected.length - 1}
                  aria-label={`Move ${topic} down`}
                  className="grid h-7 w-7 place-items-center rounded text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggle(topic)}
                  aria-label={`Remove ${topic}`}
                  className="grid h-7 w-7 place-items-center rounded text-muted transition-colors hover:bg-card-hover hover:text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={submit}
          disabled={!selected.length || saving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {saving ? "Saving…" : submitLabel}
        </button>
        {!selected.length && (
          <p className="mt-2 text-xs text-muted-foreground">Pick at least one topic to continue.</p>
        )}
      </div>
    </div>
  );
}
