import { FormEvent, Fragment, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

type Photo = {
  id: number;
  src: string;
  alt: string;
  event: string;
  year: string;
  caption: string;
};

const photos: Photo[] = [
  { id: 1, src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=85", alt: "Portrait at a film premiere", event: "Film Premiere", year: "2026", caption: "Arriving at the London film premiere" },
  { id: 2, src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=85", alt: "Portrait at an awards event", event: "Awards", year: "2026", caption: "The annual cinema awards in Los Angeles" },
  { id: 3, src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=85", alt: "Guest on the red carpet", event: "Met Gala", year: "2025", caption: "On the steps of the Met Gala" },
  { id: 4, src: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1200&q=85", alt: "Actor posing for photographers", event: "Film Premiere", year: "2025", caption: "A New York premiere appearance" },
  { id: 5, src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=85", alt: "Celebrity portrait at a press event", event: "Press Tour", year: "2024", caption: "Portrait from the international press tour" },
  { id: 6, src: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=1200&q=85", alt: "Guest attending a fashion show", event: "Fashion Week", year: "2024", caption: "Front row during Paris Fashion Week" },
  { id: 7, src: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=1200&q=85", alt: "Actor at an awards ceremony", event: "Awards", year: "2023", caption: "The British film awards ceremony" },
  { id: 8, src: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=1200&q=85", alt: "Portrait from a film festival", event: "Film Festival", year: "2023", caption: "Photographed at the Venice Film Festival" },
  { id: 9, src: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=1200&q=85", alt: "Guest at a fashion event", event: "Fashion Week", year: "2022", caption: "A show during London Fashion Week" },
  { id: 10, src: "https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=1200&q=85", alt: "Celebrity posing at a red carpet event", event: "Met Gala", year: "2026", caption: "A striking red carpet arrival" },
  { id: 11, src: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=1200&q=85", alt: "Actor attending a press event", event: "Press Tour", year: "2025", caption: "Meeting the press ahead of a new release" },
  { id: 12, src: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85", alt: "Fashion week street-style portrait", event: "Fashion Week", year: "2026", caption: "Street style outside the season’s biggest show" },
];

const events = [...new Set(photos.map((photo) => photo.event))].sort();
const years = [...new Set(photos.map((photo) => photo.year))].sort().reverse();

function Advertisement({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center overflow-hidden bg-[#0c2944] px-7 text-center text-white ${compact ? "min-h-64 py-10" : "min-h-[44rem] py-14"}`}>
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-sky-200">The weekend edit</p>
        <p className={`font-editorial mt-4 leading-none ${compact ? "text-5xl" : "text-4xl"}`}>Travel beautifully.</p>
        <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-sky-100">Discover extraordinary stays, remarkable views, and a little more time for yourself.</p>
        <span className="mt-7 inline-block border border-white px-5 py-3 text-[0.65rem] font-bold uppercase tracking-[0.16em]">Explore now</span>
      </div>
    </div>
  );
}

export function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() || "search_result";
  const [searchValue, setSearchValue] = useState(query);
  const [event, setEvent] = useState("All events");
  const [year, setYear] = useState("All years");

  const filteredPhotos = useMemo(
    () => photos.filter((photo) => (event === "All events" || photo.event === event) && (year === "All years" || photo.year === year)),
    [event, year],
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = searchValue.trim();
    if (nextQuery) setSearchParams({ q: nextQuery });
  }

  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <section className="border-b border-neutral-950 bg-white px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <div className="mx-auto max-w-[92rem]">
          <p className="text-xs font-bold uppercase tracking-[0.2em]">Celebrity image archive</p>
          <div className="mt-3 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-editorial text-5xl leading-none tracking-[-0.035em] sm:text-7xl">
                Results for <span className="italic">“{query}”</span>
              </h1>
              <p className="mt-4 text-sm text-neutral-600">{filteredPhotos.length} photographs found</p>
            </div>
            <form className="flex w-full max-w-lg border-b-2 border-neutral-950" onSubmit={submitSearch} role="search">
              <label className="sr-only" htmlFor="archive-search">Search the image archive</label>
              <input className="min-w-0 flex-1 bg-transparent py-3 text-lg outline-none placeholder:text-neutral-400" id="archive-search" onChange={(event) => setSearchValue(event.target.value)} placeholder="Search a celebrity" type="search" value={searchValue} />
              <button aria-label="Submit search" className="px-3 text-2xl" type="submit">⌕</button>
            </form>
          </div>
        </div>
      </section>

      <div className="sticky top-0 z-20 border-b border-neutral-300 bg-white/95 px-5 backdrop-blur sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[92rem] flex-wrap items-center gap-3 py-5 sm:gap-5">
          <span className="mr-2 text-xs font-bold uppercase tracking-[0.18em]">Filter by</span>
          <label className="relative">
            <span className="sr-only">Event</span>
            <select className="min-w-44 appearance-none rounded-full border border-neutral-950 bg-transparent py-2.5 pl-5 pr-11 text-sm font-semibold outline-offset-4" onChange={(event) => setEvent(event.target.value)} value={event}>
              <option>All events</option>
              {events.map((item) => <option key={item}>{item}</option>)}
            </select>
            <span aria-hidden="true" className="pointer-events-none absolute right-4 top-2.5">⌄</span>
          </label>
          <label className="relative">
            <span className="sr-only">Year</span>
            <select className="min-w-36 appearance-none rounded-full border border-neutral-950 bg-transparent py-2.5 pl-5 pr-11 text-sm font-semibold outline-offset-4" onChange={(event) => setYear(event.target.value)} value={year}>
              <option>All years</option>
              {years.map((item) => <option key={item}>{item}</option>)}
            </select>
            <span aria-hidden="true" className="pointer-events-none absolute right-4 top-2.5">⌄</span>
          </label>
          {(event !== "All events" || year !== "All years") && <button className="ml-auto text-xs font-bold uppercase tracking-[0.12em] underline underline-offset-4" onClick={() => { setEvent("All events"); setYear("All years"); }} type="button">Clear filters</button>}
        </div>
      </div>

      <main className="mx-auto max-w-[92rem] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        {filteredPhotos.length ? (
          <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_16rem] xl:gap-8">
            <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
              {filteredPhotos.map((photo, index) => (
                <Fragment key={photo.id}>
                  <article>
                    <div className="aspect-[4/5] overflow-hidden bg-neutral-200">
                      <img alt={photo.alt} className="h-full w-full object-cover transition duration-500 hover:scale-[1.02]" decoding="async" loading="lazy" src={photo.src} />
                    </div>
                    <div className="mt-4 flex items-start justify-between gap-4 border-t border-neutral-950 pt-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em]">{photo.event}</p>
                        <p className="mt-2 text-base leading-snug">{photo.caption}</p>
                      </div>
                      <time className="text-sm tabular-nums text-neutral-600">{photo.year}</time>
                    </div>
                  </article>

                  {index === 5 && (
                    <aside aria-label="Advertisement" className="col-span-full border-y border-neutral-300 py-10">
                      <p className="mb-5 text-center text-[0.65rem] uppercase tracking-[0.25em] text-neutral-500">Advertisement</p>
                      <Advertisement compact />
                    </aside>
                  )}
                </Fragment>
              ))}
            </div>

            <aside aria-label="Advertisement" className="sticky top-24 hidden xl:block">
              <p className="mb-4 text-center text-[0.65rem] uppercase tracking-[0.25em] text-neutral-500">Advertisement</p>
              <Advertisement />
            </aside>
          </div>
        ) : (
          <div className="py-24 text-center">
            <h2 className="font-editorial text-5xl">No photographs found</h2>
            <p className="mt-4 text-neutral-600">Try clearing one of the filters.</p>
          </div>
        )}
      </main>
    </div>
  );
}
