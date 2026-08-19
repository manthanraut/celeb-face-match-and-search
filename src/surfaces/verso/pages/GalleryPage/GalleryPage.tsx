import { Fragment, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { gallery, type GalleryImage } from "./galleryData";

const adSlotStyles = {
  inline: {
    className: "min-h-32 w-full",
    size: "640 × 100",
  },
  leaderboard: {
    className: "mx-auto min-h-24 w-full max-w-[60.625rem]",
    size: "970 × 90",
  },
  "rail-rectangle": {
    className: "min-h-[15.625rem] w-full max-w-[18.75rem]",
    size: "300 × 250",
  },
  "rail-tall": {
    className: "min-h-[37.5rem] w-full max-w-[18.75rem]",
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
    <figure className="[content-visibility:auto] [contain-intrinsic-size:auto_54rem]">
      <div className="mx-auto max-w-[34rem] bg-neutral-100">
        <img
          alt={image.alt}
          className="block h-auto max-h-[50rem] w-full object-contain"
          decoding="async"
          fetchPriority={isFirstImage ? "high" : "auto"}
          height="1440"
          loading={isFirstImage ? "eager" : "lazy"}
          src={image.src}
          width="960"
        />
      </div>

      <figcaption className="mx-auto grid max-w-[34rem] gap-2 border-b border-neutral-300 px-1 py-4 text-sm leading-6 sm:grid-cols-[auto_1fr]">
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
      className="px-5 py-16 text-center sm:px-8 sm:py-20"
    >
      <h2
        className="mx-auto max-w-4xl text-balance text-4xl font-medium leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-[4rem]"
        id="newsletter-title"
      >
        Get the latest fashion stories, style, and tips, handpicked for you.
      </h2>
      <p className="mt-7 text-lg">Vogue Daily Newsletter</p>

      <form
        className="mx-auto mt-10 flex max-w-5xl flex-col sm:flex-row"
        onSubmit={handleSubmit}
      >
        <label className="sr-only" htmlFor="newsletter-email">
          Email address
        </label>
        <input
          autoComplete="email"
          className="min-h-14 min-w-0 flex-1 border border-neutral-300 bg-white px-4 text-base outline-none focus-visible:border-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:bg-neutral-100"
          disabled={hasSubmitted}
          id="newsletter-email"
          name="email"
          placeholder="Email address"
          required
          type="email"
        />
        <button
          className="min-h-14 bg-neutral-950 px-10 text-sm font-semibold uppercase tracking-[0.13em] text-white transition-colors hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-500"
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

export function GalleryPage() {
  return (
    <article className="bg-white pb-12 text-neutral-950">
      <header className="mx-auto max-w-[80rem] px-5 pb-10 pt-12 text-center sm:px-8 sm:pt-14 lg:pb-12 lg:pt-16">
        <Link
          className="text-xs font-semibold uppercase tracking-[0.18em] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950"
          to="/galleries/met-gala-2026"
        >
          {gallery.category}
        </Link>

        <h1 className="font-editorial mx-auto mt-5 max-w-5xl text-balance text-4xl leading-[0.96] tracking-[-0.035em] sm:text-5xl lg:text-[4.75rem]">
          {gallery.title}
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-pretty text-base leading-7 text-neutral-700 sm:text-lg">
          {gallery.description}
        </p>

        <div className="mt-6 text-sm leading-6">
          <p>
            By <span className="font-semibold">{gallery.author.name}</span>
          </p>
          <time className="text-neutral-600" dateTime="2026-05-05">
            {gallery.publishedDate}
          </time>
        </div>
      </header>

      <div className="mx-auto max-w-[40rem] px-5 pb-12 sm:px-8 sm:pb-16">
        {gallery.introduction.map((paragraph) => (
          <p
            className="mb-5 font-serif text-lg leading-[1.7] text-neutral-800 last:mb-0 sm:text-xl"
            key={paragraph}
          >
            {paragraph}
          </p>
        ))}
      </div>

      <div className="px-5 pb-12 sm:px-8 sm:pb-16">
        <AdSlot variant="leaderboard" />
      </div>

      <section aria-labelledby="gallery-slideshow-title">
        <h2 className="sr-only" id="gallery-slideshow-title">
          2026 Met Gala red carpet slideshow
        </h2>

        <div className="mx-auto grid max-w-[76rem] items-start gap-14 px-5 sm:px-8 lg:grid-cols-[minmax(0,42rem)_18.75rem] lg:justify-center lg:gap-16">
          <div className="space-y-14 sm:space-y-16">
            {gallery.images.map((image, index) => (
              <Fragment key={image.id}>
                <GallerySlide image={image} index={index} total={gallery.images.length} />
                {index === 4 ? <AdSlot variant="inline" /> : null}
              </Fragment>
            ))}
          </div>

          <aside
            aria-hidden="true"
            className="hidden content-start gap-[32rem] pt-8 lg:grid"
          >
            <AdSlot variant="rail-rectangle" />
            <AdSlot variant="rail-tall" />
          </aside>
        </div>
      </section>

      <section
        aria-labelledby="gallery-search-title"
        className="mt-16 border-y border-neutral-950 bg-[#ece8df] sm:mt-20"
      >
        <div className="mx-auto grid max-w-[76rem] gap-7 px-5 py-10 sm:px-8 sm:py-12 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em]">
              AI-powered image discovery
            </p>
            <h2
              className="font-editorial mt-3 text-balance text-3xl leading-none tracking-[-0.025em] sm:text-4xl"
              id="gallery-search-title"
            >
              Keep exploring beyond this gallery
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-700 sm:text-base">
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

      <footer className="mx-auto max-w-[74rem] px-5 pt-14 sm:px-8 sm:pt-16">
        <section
          aria-labelledby="author-title"
          className="grid gap-7 border-y border-neutral-300 py-10 sm:grid-cols-[10rem_1fr] sm:items-start"
        >
          <img
            alt={gallery.author.image.alt}
            className="aspect-square size-40 object-cover"
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
            <p className="max-w-4xl text-lg leading-8 sm:text-xl sm:leading-9">
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
          className="flex flex-wrap items-center gap-x-12 gap-y-4 border-b border-neutral-300 py-8 text-lg"
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
