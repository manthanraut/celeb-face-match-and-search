import { Fragment, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { gallery, type GalleryImage } from "./galleryData";

const adSlotStyles = {
  inline: {
    className: "min-h-32 w-full",
    size: "640 × 100",
  },
  leaderboard: {
    className: "mx-auto min-h-24 w-full max-w-[45.5rem]",
    size: "728 × 90",
  },
  "rail-tall": {
    className: "min-h-[37.5rem] w-full max-w-[20rem]",
    size: "300 × 600",
  },
} as const;

type AdSlotVariant = keyof typeof adSlotStyles;

type AdSlotProps = {
  variant: AdSlotVariant;
};

function AdSlot({ variant }: AdSlotProps) {
  const slot = adSlotStyles[variant];

  return (
    <div
      aria-hidden="true"
      className={[
        "flex items-center justify-center border border-neutral-300 bg-neutral-100 px-5 py-6 text-center text-neutral-500",
        slot.className,
      ].join(" ")}
    >
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em]">
          Advertisement
        </p>
        <p className="mt-2 text-xs tabular-nums">{slot.size} placeholder</p>
      </div>
    </div>
  );
}

type GallerySlideProps = {
  image: GalleryImage;
  index: number;
  total: number;
};

function GallerySlide({ image, index, total }: GallerySlideProps) {
  const isFirstImage = index === 0;

  return (
    <figure className="[content-visibility:auto] [contain-intrinsic-size:auto_46rem]">
      <div className="mx-auto max-w-[28rem] bg-neutral-100">
        <img
          alt={image.alt}
          className="block h-auto max-h-[42rem] w-full object-contain"
          decoding="async"
          fetchPriority={isFirstImage ? "high" : "auto"}
          height="1440"
          loading={isFirstImage ? "eager" : "lazy"}
          src={image.src}
          width="960"
        />
      </div>

      <figcaption className="mx-auto grid max-w-[28rem] gap-2 border-b border-neutral-300 px-1 py-3 text-xs leading-5 sm:grid-cols-[auto_1fr]">
        <span className="font-semibold tabular-nums">
          {index + 1} / {total}
        </span>
        <span>
          {image.caption}
          <span className="ml-2 text-neutral-500">{image.credit}</span>
        </span>
      </figcaption>
    </figure>
  );
}

function InstagramMark() {
  return (
    <span
      aria-label="Instagram"
      className="mt-5 inline-flex size-11 items-center justify-center"
      role="img"
    >
      <svg
        aria-hidden="true"
        className="size-9"
        fill="none"
        viewBox="0 0 24 24"
      >
        <rect
          height="18"
          rx="5"
          stroke="currentColor"
          strokeWidth="1.8"
          width="18"
          x="3"
          y="3"
        />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.4" cy="6.7" fill="currentColor" r="1.1" />
      </svg>
    </span>
  );
}

function NewsletterSignup() {
  const [hasSubmitted, setHasSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
  }

  return (
    <section
      aria-labelledby="newsletter-title"
      className="px-5 py-12 text-center sm:px-8 sm:py-16"
    >
      <h2
        className="mx-auto max-w-3xl text-balance text-3xl font-medium leading-[1.08] tracking-[-0.03em] sm:text-4xl lg:text-[3rem]"
        id="newsletter-title"
      >
        Get the latest fashion stories, style, and tips, handpicked for you.
      </h2>
      <p className="mt-5 text-base">Vogue Daily Newsletter</p>

      <form
        className="mx-auto mt-7 flex max-w-4xl flex-col sm:flex-row"
        onSubmit={handleSubmit}
      >
        <label className="sr-only" htmlFor="newsletter-email">
          Email address
        </label>
        <input
          autoComplete="email"
          className="min-h-12 min-w-0 flex-1 border border-neutral-300 bg-white px-4 text-sm outline-none focus-visible:border-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:bg-neutral-100"
          disabled={hasSubmitted}
          id="newsletter-email"
          name="email"
          placeholder="Email address"
          required
          type="email"
        />
        <button
          className="min-h-12 bg-neutral-950 px-9 text-xs font-semibold uppercase tracking-[0.13em] text-white transition-colors hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-500"
          disabled={hasSubmitted}
          type="submit"
        >
          Sign up
        </button>
      </form>

      <p aria-live="polite" className="mx-auto mt-4 min-h-6 max-w-3xl text-sm leading-6">
        {hasSubmitted
          ? "Thanks—newsletter signup is mocked for this prototype."
          : "By signing up, you agree to our user agreement and acknowledge our privacy policy."}
      </p>
    </section>
  );
}

const gallerySections = [
  gallery.images.slice(0, 5),
  gallery.images.slice(5),
] as const;

export function GalleryPage() {
  return (
    <article className="bg-white pb-8 text-neutral-950">
      <header className="mx-auto max-w-[64rem] px-5 pb-8 pt-8 text-center sm:px-8 sm:pb-10 sm:pt-10 lg:pt-12">
        <Link
          className="text-xs font-semibold uppercase tracking-[0.18em] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950"
          to="/galleries/met-gala-2026"
        >
          {gallery.category}
        </Link>

        <h1 className="font-editorial mx-auto mt-4 max-w-4xl text-balance text-3xl leading-[0.98] tracking-[-0.03em] sm:text-4xl lg:text-[3.5rem]">
          {gallery.title}
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm leading-6 text-neutral-700 sm:text-base">
          {gallery.description}
        </p>

        <div className="mt-4 text-xs leading-5">
          <p>
            By <span className="font-semibold">{gallery.author.name}</span>
          </p>
          <time className="text-neutral-600" dateTime="2026-05-05">
            {gallery.publishedDate}
          </time>
        </div>
      </header>

      <div className="mx-auto max-w-[36rem] px-5 pb-10 sm:px-8 sm:pb-12">
        {gallery.introduction.map((paragraph) => (
          <p
            className="mb-4 font-serif text-base leading-[1.65] text-neutral-800 last:mb-0"
            key={paragraph}
          >
            {paragraph}
          </p>
        ))}
      </div>

      <div className="px-5 pb-10 sm:px-8 sm:pb-12">
        <AdSlot variant="leaderboard" />
      </div>

      <section aria-labelledby="gallery-slideshow-title">
        <h2 className="sr-only" id="gallery-slideshow-title">
          2026 Met Gala red carpet slideshow
        </h2>

        <div className="mx-auto max-w-[70rem] space-y-12 px-5 sm:space-y-14 sm:px-8">
          {gallerySections.map((images, sectionIndex) => (
            <Fragment key={`gallery-section-${sectionIndex + 1}`}>
              <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,34rem)_20rem] lg:justify-center lg:gap-12">
                <div className="space-y-10 sm:space-y-12">
                  {images.map((image, imageIndex) => {
                    const absoluteIndex = sectionIndex * 5 + imageIndex;

                    return (
                      <GallerySlide
                        image={image}
                        index={absoluteIndex}
                        key={image.id}
                        total={gallery.images.length}
                      />
                    );
                  })}
                </div>

                <aside
                  aria-label={`Advertisement rail ${sectionIndex + 1}`}
                  className="relative hidden h-full min-h-[52rem] lg:block"
                >
                  <div className="sticky top-24">
                    <AdSlot variant="rail-tall" />
                  </div>
                </aside>
              </div>

              {sectionIndex === 0 ? (
                <div className="mx-auto max-w-[45.5rem]">
                  <AdSlot variant="inline" />
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="gallery-search-title"
        className="mt-12 border-y border-neutral-950 bg-[#ece8df] sm:mt-16"
      >
        <div className="mx-auto grid max-w-[70rem] gap-6 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em]">
              AI-powered image discovery
            </p>
            <h2
              className="font-editorial mt-2 text-balance text-2xl leading-none tracking-[-0.025em] sm:text-3xl"
              id="gallery-search-title"
            >
              Keep exploring beyond this gallery
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-700">
              Find every photograph of a celebrity across the wider image archive.
            </p>
          </div>

          <Link
            className="inline-flex min-h-11 w-full items-center justify-center bg-neutral-950 px-6 py-2.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950 sm:w-fit"
            to="/discover?q=search_result"
          >
            Explore image gallery
            <span aria-hidden="true" className="ml-3 text-lg">
              →
            </span>
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-[64rem] px-5 pt-10 sm:px-8 sm:pt-12">
        <section
          aria-labelledby="author-title"
          className="grid gap-5 border-y border-neutral-300 py-8 sm:grid-cols-[7rem_1fr] sm:items-start"
        >
          <img
            alt={gallery.author.image.alt}
            className="aspect-square size-28 object-cover"
            decoding="async"
            height="350"
            loading="lazy"
            src={gallery.author.image.src}
            width="350"
          />
          <div>
            <h2 className="sr-only" id="author-title">
              About the author
            </h2>
            <p className="max-w-3xl text-base leading-7">
              <a
                className="font-medium underline underline-offset-4 hover:text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950"
                href={gallery.author.profileUrl}
                rel="noreferrer"
                target="_blank"
              >
                {gallery.author.name}
              </a>{" "}
              {gallery.author.bio}
            </p>
            <InstagramMark />
          </div>
        </section>

        <section
          aria-labelledby="topics-title"
          className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-neutral-300 py-6 text-base"
        >
          <h2 className="font-normal" id="topics-title">
            Topics
          </h2>
          {gallery.topics.map((topic) => (
            <Link
              className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950"
              key={topic}
              to="/galleries/met-gala-2026"
            >
              {topic}
            </Link>
          ))}
        </section>

        <NewsletterSignup />
      </footer>
    </article>
  );
}
