import type { ReactNode } from "react";

import type { DiscoveryImageDetails } from "./discoveryImageDetails.js";

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
  return (
    <article>
      <div className="group relative aspect-[4/5] overflow-hidden bg-neutral-200">
        <button
          aria-label={`View image details for ${details.celebrityName}`}
          className="block h-full w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
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
        </button>
        {action}
      </div>
      {children}
    </article>
  );
}
