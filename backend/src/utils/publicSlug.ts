import Event from "../models/Event";

/**
 * Generate a unique public slug based on a title plus a short random suffix.
 * Exported for reuse & unit testing.
 */
export async function generateUniquePublicSlug(title: string): Promise<string> {
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  const base = slugify(title) || "event";
  for (let i = 0; i < 5; i++) {
    const suffix = Math.random().toString(16).slice(2, 6);
    const candidate = `${base}-${suffix}`.slice(0, 60);
    const existing = await Event.findOne({ publicSlug: candidate }).select(
      "_id"
    );
    if (!existing) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 60);
}
