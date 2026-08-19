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
      <div className="group relative aspect-[4/5] overflow-hidden bg-[#e8d9d1]">
        <button
          aria-label={`View image details for ${details.celebrityName}`}
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
        {action}
      </div>
      {children}
    </article>
  );
}
