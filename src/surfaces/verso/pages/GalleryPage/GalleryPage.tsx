import { Link } from "react-router-dom";

const gallery = {
  category: "Met Gala",
  title: "See Every Look from the 2026 Met Gala Red Carpet",
  description:
    "Fashion’s biggest night returned to New York with an artful red carpet. Explore one of the evening’s standout arrivals, then discover every photograph of the celebrities you follow.",
  author: "Hannah Jackson",
  publishedDate: new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date("2026-05-05T00:00:00Z")),
  introduction: [
    "The 2026 Met Gala celebrated Costume Art, inviting guests to treat the dressed body as a canvas. The result was a red carpet shaped by dramatic silhouettes, intricate craft, and highly personal interpretations of the theme.",
    "This prototype turns that visual coverage into a searchable experience. Start with the gallery, then use celebrity recognition to move beyond a single story and find appearances across the wider photo archive.",
  ],
  image: {
    src: "https://assets.vogue.com/photos/69f944e4d3920bc0f1e59746/2:3/w_1200,c_limit/2274551577",
    alt: "Rihanna wearing an embellished sculptural gown on the 2026 Met Gala red carpet.",
    caption:
      "Rihanna in Maison Margiela, with jewelry by Glenn Spiro and Fred Leighton.",
    credit: "Photo: Getty Images",
  },
} as const;

export function GalleryPage() {
  return (
    <article className="bg-white pb-20 text-neutral-950">
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
            By <span className="font-semibold">{gallery.author}</span>
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

      <section
        aria-labelledby="gallery-search-title"
        className="border-y border-neutral-950 bg-[#ece8df]"
      >
        <div className="mx-auto grid max-w-[80rem] gap-7 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em]">
              AI-powered image discovery
            </p>
            <h2
              className="font-editorial mt-3 text-balance text-3xl leading-none tracking-[-0.025em] sm:text-4xl"
              id="gallery-search-title"
            >
              Looking for a Particular Celebrity?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-700 sm:text-base">
              Search the archive to find every photograph in which they appear—not just the
              images in this gallery.
            </p>
          </div>

          <Link
            className="inline-flex min-h-11 w-full items-center justify-center bg-neutral-950 px-6 py-2.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950 sm:w-fit"
            to="/discover?q=search_result"
          >
            Explore celebrity photos
            <span aria-hidden="true" className="ml-3 text-lg">
              →
            </span>
          </Link>
        </div>
      </section>

      <figure className="mx-auto mt-12 max-w-[68rem] px-0 sm:mt-16 sm:px-8">
        <div className="bg-neutral-100">
          <img
            alt={gallery.image.alt}
            className="mx-auto block h-auto w-full max-w-[75rem] object-cover"
            decoding="async"
            height="1800"
            loading="lazy"
            src={gallery.image.src}
            width="1200"
          />
        </div>

        <figcaption className="grid gap-3 border-b border-neutral-300 px-5 py-5 text-sm leading-6 sm:grid-cols-[auto_1fr_auto] sm:px-0">
          <span className="font-semibold tabular-nums">1 / 1</span>
          <span>{gallery.image.caption}</span>
          <span className="text-neutral-600 sm:text-right">{gallery.image.credit}</span>
        </figcaption>
      </figure>
    </article>
  );
}
