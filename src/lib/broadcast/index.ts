import type { BroadcastPlatform } from "../constants";

/**
 * Broadcast delivery layer.
 *
 * Delivery is MOCKED (BRD allows "mocked or actual") — no external API keys are
 * required — but we return *real, actionable* deep links where the platform
 * supports them (WhatsApp/LinkedIn/mailto), so the buttons in the UI genuinely
 * work. Swapping in SendGrid / the LinkedIn API / WhatsApp Business is a
 * one-function change here.
 */

export type BroadcastResult = {
  platform: BroadcastPlatform;
  status: "sent" | "failed";
  recipient: string | null;
  shareUrl: string | null; // real deep link, when the platform supports one
  detail: string;
};

const DETAIL: Record<BroadcastPlatform, string> = {
  email: "Queued to mock email service",
  linkedin: "Draft prepared for LinkedIn share",
  whatsapp: "Ready to share to WhatsApp",
  blog: "Added to the blog draft queue",
  newsletter: "Added to the next newsletter issue",
};

/** Build a genuinely-openable share/deep link for platforms that support one. */
export function buildShareUrl(
  platform: BroadcastPlatform,
  content: string,
  itemUrl: string,
): string | null {
  switch (platform) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(content)}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(itemUrl)}`;
    case "email": {
      const subjectMatch = content.match(/^Subject:\s*(.+)$/m);
      const subject = subjectMatch ? subjectMatch[1] : "AI News worth sharing";
      const body = content.replace(/^Subject:.*$/m, "").trim();
      return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
    default:
      return null; // blog / newsletter have no external deep link
  }
}

/** Simulate delivery to a platform and return a structured result. */
export async function deliver(
  platform: BroadcastPlatform,
  content: string,
  itemUrl: string,
  recipient?: string | null,
): Promise<BroadcastResult> {
  const shareUrl = buildShareUrl(platform, content, itemUrl);
  // Simulate a little network latency so the UI shows a real "sending" state.
  await new Promise((r) => setTimeout(r, 200));
  return {
    platform,
    status: "sent",
    recipient: recipient ?? null,
    shareUrl,
    detail: DETAIL[platform],
  };
}
