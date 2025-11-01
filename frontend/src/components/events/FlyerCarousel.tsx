import { useState } from "react";

interface FlyerCarouselProps {
  flyerUrl?: string;
  secondaryFlyerUrl?: string;
  className?: string;
}

/**
 * FlyerCarousel component displays event flyers in a carousel.
 *
 * Supports:
 * - Single flyer (backward compatible)
 * - Two flyers with navigation controls
 * - Responsive design
 */
export default function FlyerCarousel({
  flyerUrl,
  secondaryFlyerUrl,
  className = "",
}: FlyerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Collect available flyers
  const flyers = [flyerUrl, secondaryFlyerUrl].filter((url): url is string =>
    Boolean(url)
  );

  // If no flyers, render nothing
  if (flyers.length === 0) {
    return null;
  }

  // If only one flyer, display it directly without carousel controls
  if (flyers.length === 1) {
    return (
      <div className={`relative ${className}`}>
        <img
          src={flyers[0]}
          alt="Event flyer"
          className="w-full max-h-full rounded-lg border border-gray-200 object-contain"
        />
      </div>
    );
  }

  // Multiple flyers - show carousel with navigation
  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? flyers.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === flyers.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Main Image */}
      <div className="relative overflow-hidden rounded-lg border border-gray-200">
        <img
          src={flyers[currentIndex]}
          alt={`Event flyer ${currentIndex + 1}`}
          className="w-full max-h-full object-contain transition-opacity duration-300"
        />

        {/* Navigation Buttons - visible on hover */}
        <button
          onClick={goToPrevious}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          aria-label="Previous flyer"
        >
          <svg
            className="w-6 h-6 text-gray-800"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <button
          onClick={goToNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          aria-label="Next flyer"
        >
          <svg
            className="w-6 h-6 text-gray-800"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Indicator Dots */}
      <div className="flex justify-center gap-2 mt-3">
        {flyers.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              index === currentIndex
                ? "bg-blue-600 w-4"
                : "bg-gray-300 hover:bg-gray-400"
            }`}
            aria-label={`Go to flyer ${index + 1}`}
          />
        ))}
      </div>

      {/* Counter */}
      <div className="text-center text-sm text-gray-600 mt-2">
        {currentIndex + 1} / {flyers.length}
      </div>
    </div>
  );
}
