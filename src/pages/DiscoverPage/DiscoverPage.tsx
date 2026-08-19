import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router-dom";

import { sampleArchiveImages } from "../../data/sampleArchive";
import { DiscoveryImageCard } from "./DiscoveryImageCard";
import { DiscoveryImageDialog } from "./DiscoveryImageDialog";
import {
  toDiscoveryImageDetails,
  type DiscoveryImageDetails,
} from "./discoveryImageDetails";
import { SearchHubPage } from "./SearchHubPage";

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
  const celebrity = searchParams.get("celebrity")?.trim() || "Tracee Ellis Ross";
  const [searchValue, setSearchValue] = useState(celebrity);
  const [event, setEvent] = useState("All events");
  const [year, setYear] = useState("All years");

  const celebrityPhotos = useMemo<DiscoveryImageDetails[]>(() => sampleArchiveImages.flatMap((image) => {
    const matchingCelebrity = image.celebrities.find(
      (item) => item.status === "Approved" && item.canonical_name.toLocaleLowerCase() === celebrity.toLocaleLowerCase(),
    );
    if (!image.enrichment_state.search_ready || !matchingCelebrity) return [];
    return [toDiscoveryImageDetails(image, matchingCelebrity)];
  }), [celebrity]);

  const availablePhotos = celebrityPhotos;
  const events = useMemo(
    () => [
      ...new Set(
        availablePhotos.flatMap((photo) =>
          photo.eventName ? [photo.eventName] : [],
        ),
      ),
    ].sort(),
    [availablePhotos],
  );
  const years = useMemo(
    () => [
      ...new Set(
        availablePhotos.flatMap((photo) =>
          photo.year === null ? [] : [photo.year],
        ),
      ),
    ].sort((first, second) => second - first),
    [availablePhotos],
  );

  const filteredPhotos = useMemo(
    () => availablePhotos.filter((photo) => (event === "All events" || photo.eventName === event) && (year === "All years" || String(photo.year) === year)),
    [availablePhotos, event, year],
  );
  const selectedImage = availablePhotos.find(
    (photo) => photo.id === searchParams.get("photo"),
  ) ?? null;

  useEffect(() => {
    setSearchValue(celebrity);
    setEvent("All events");
    setYear("All years");
  }, [celebrity]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = searchValue.trim();
    if (nextQuery) setSearchParams({ q: "search_result", celebrity: nextQuery });
  }

  function openImage(details: DiscoveryImageDetails) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("photo", details.id);
    setSearchParams(nextParams);
  }

  function dismissImage() {
    if (!searchParams.has("photo")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("photo");
    setSearchParams(nextParams, { replace: true });
  }

  if (!searchParams.has("q")) {
    return <SearchHubPage />;
  }

  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <section className="border-b border-neutral-950 bg-white px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <div className="mx-auto max-w-[92rem]">
          <p className="text-xs font-bold uppercase tracking-[0.2em]">Celebrity image archive</p>
          <div className="mt-3 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-editorial text-5xl leading-none tracking-[-0.035em] sm:text-7xl">
                Results for <span className="italic">“{celebrity}”</span>
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
                  <DiscoveryImageCard
                    details={photo}
                    onOpen={openImage}
                  >
                    <div className="mt-4 flex items-start justify-between gap-4 border-t border-neutral-950 pt-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em]">{photo.eventName ?? "Archive"}</p>
                        <p className="mt-2 text-base leading-snug">{photo.caption ?? photo.backStory ?? `${photo.celebrityName} archive photograph`}</p>
                      </div>
                      <time className="text-sm tabular-nums text-neutral-600">{photo.year ?? "—"}</time>
                    </div>
                  </DiscoveryImageCard>

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
      <DiscoveryImageDialog
        details={selectedImage}
        onDismiss={dismissImage}
      />
    </div>
  );
}
