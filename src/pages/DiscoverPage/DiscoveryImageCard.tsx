import type { ReactNode } from "react";

import type { DiscoveryImageDetails } from "./discoveryImageDetails.js";

const backstoryIndicatorUrl = new URL(
  "../../assets/backstory-indicator.png",
  import.meta.url,
).href;

type DiscoveryImageCardProps = {
  action?: ReactNode;
  children: ReactNode;
  details: DiscoveryImageDetails;
  imageClassName?: string;
  onOpen: (details: DiscoveryImageDetails) => void;
};

export function DiscoveryImageCard({
  action,
  children,
  details,
  imageClassName = "",
  onOpen,
}: DiscoveryImageCardProps) {
  const hasBackStory = Boolean(details.backStory?.trim());

  return (
    <article>
      <div className="group relative aspect-[4/5] overflow-hidden bg-[#e8d9d1]">
        <button
          aria-label={`View image details for ${details.celebrityName}${hasBackStory ? "; backstory available" : ""}`}
          className="relative block h-full w-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
          onClick={() => onOpen(details)}
          type="button"
        >
          <img
            alt={details.altText}
            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${imageClassName}`}
            decoding="async"
            height="1000"
            loading="lazy"
            src={details.imageUrl}
            width="800"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-black opacity-0 transition-opacity duration-300 group-hover:opacity-[0.14] motion-reduce:transition-none"
          />
        </button>
        {hasBackStory && (
          <img
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-3 z-10 h-10 w-[3.75rem] rounded-md border-2 border-white bg-black object-cover shadow-[0_3px_14px_rgba(0,0,0,0.65)] sm:right-4 sm:top-4"
            decoding="async"
            height="40"
            src={backstoryIndicatorUrl}
            width="60"
          />
        )}
        {action}
      </div>
      {children}
    </article>
  );
}
