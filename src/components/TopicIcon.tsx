import type { CSSProperties, ReactNode } from "react";
import { isTopic, type Topic } from "@/lib/topics";

/**
 * Custom, hand-drawn section glyphs — one per topic, plus Trending and a
 * unified AI mark. They share a single house style (24px grid, round caps,
 * `currentColor` stroke) so they blend with the lucide icons used elsewhere
 * while staying distinctly ours. Color is inherited from the parent's text
 * color, so callers tint each glyph with its topic accent.
 */

type IconProps = { className?: string; style?: CSSProperties };

/** Shared SVG frame matching lucide's stroke conventions. */
function Glyph({
  className,
  style,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Trending — a flame. */
function IconTrending(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3c2.5 3.2 5 5 5 8.5a5 5 0 0 1-10 0c0-1.4.5-2.5 1.3-3.4.2 1.2.9 1.9 2 2.1C9.6 8.7 10.3 6.2 12 3Z" />
    </Glyph>
  );
}

/** AI — a processor die with pins (the app's unified "AI" mark). */
export function IconAI(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="8" y="8" width="8" height="8" rx="1.5" />
      <path d="M10 8V5M14 8V5M10 19v-3M14 19v-3M8 10H5M8 14H5M19 10h-3M19 14h-3" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Technology — code brackets. */
function IconTechnology(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M8.5 8 4.5 12l4 4" />
      <path d="M15.5 8l4 4-4 4" />
      <path d="M13.5 5.5l-3 13" />
    </Glyph>
  );
}

/** World & Politics — a globe. */
function IconWorld(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.6 2.4 2.6 14.6 0 17" />
      <path d="M12 3.5c-2.6 2.4-2.6 14.6 0 17" />
    </Glyph>
  );
}

/** Business & Finance — an upward trend with an arrow. */
function IconBusiness(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 18l5-5.5 3.5 3L20 7" />
      <path d="M20 11.5V7h-4.5" />
    </Glyph>
  );
}

/** Science — an Erlenmeyer flask. */
function IconScience(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9 3h6" />
      <path d="M10 3v6l-4.4 8.3A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.4-2.7L14 9V3" />
      <path d="M8 14.5h8" />
    </Glyph>
  );
}

/** Sports — a ball with seams. */
function IconSports(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17" />
      <path d="M4.2 9.5c4.8 2.2 10.8 2.2 15.6 0" />
      <path d="M4.2 14.5c4.8-2.2 10.8-2.2 15.6 0" />
    </Glyph>
  );
}

/** Entertainment — a pair of beamed music notes. */
function IconEntertainment(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9 17.5V6l9-1.8v11.3" />
      <circle cx="6.8" cy="17.8" r="2.3" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="15.5" r="2.3" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Health — a heart. */
function IconHealth(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 20.5C7 16.5 4 13.5 4 9.5A4.2 4.2 0 0 1 12 7.8 4.2 4.2 0 0 1 20 9.5c0 4-3 7-8 11Z" />
    </Glyph>
  );
}

/** Fallback for any title outside the fixed taxonomy. */
function IconDot(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

const TOPIC_ICON: Record<Topic, (props: IconProps) => ReactNode> = {
  AI: IconAI,
  Technology: IconTechnology,
  "World & Politics": IconWorld,
  "Business & Finance": IconBusiness,
  Science: IconScience,
  Sports: IconSports,
  Entertainment: IconEntertainment,
  Health: IconHealth,
};

/**
 * The right custom glyph for a section header: the flame for Trending, the
 * topic's own glyph otherwise, and a neutral dot for anything off-taxonomy.
 */
export function TopicIcon({
  title,
  trending = false,
  className,
  style,
}: {
  title: string;
  trending?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const Icon = trending ? IconTrending : isTopic(title) ? TOPIC_ICON[title] : IconDot;
  return <Icon className={className} style={style} />;
}
