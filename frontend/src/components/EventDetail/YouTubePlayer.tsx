import type { EventData } from "../../types/event";

interface YouTubePlayerProps {
  event: EventData;
}

/**
 * Extracts the YouTube video ID from a URL
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 */
function extractVideoId(url: string): string | null {
  if (!url) return null;

  // Try standard watch URL: youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.+&v=)([^&]+)/,
  );
  if (watchMatch) return watchMatch[1];

  // Try short URL: youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return shortMatch[1];

  // Try embed URL: youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/youtube\.com\/embed\/([^?&]+)/);
  if (embedMatch) return embedMatch[1];

  return null;
}

/**
 * YouTube video player component for completed events
 * Displays an embedded YouTube video when the event has a youtubeUrl
 */
function YouTubePlayer({ event }: YouTubePlayerProps) {
  if (!event.youtubeUrl) return null;

  const videoId = extractVideoId(event.youtubeUrl);

  if (!videoId) {
    // If we can't extract a video ID, don't render anything
    return null;
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}`;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">Event Recording</h3>
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          className="absolute top-0 left-0 w-full h-full rounded-lg shadow-sm"
          src={embedUrl}
          title={`${event.title} - Event Recording`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </div>
  );
}

export default YouTubePlayer;
