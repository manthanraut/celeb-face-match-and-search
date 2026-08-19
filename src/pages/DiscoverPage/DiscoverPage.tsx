import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router-dom";

import {
  canonicalEventIds,
  canonicalEventNames,
  type CanonicalEventId,
} from "../../../shared/galleries";
import { useCelebritySearch } from "../../features/search/hooks";
import { DiscoveryImageCard } from "./DiscoveryImageCard";
import { DiscoveryImageDialog } from "./DiscoveryImageDialog";
import {
  toDiscoveryImageDetails,
  type DiscoveryImageDetails,
} from "./discoveryImageDetails";
import { SearchHubPage } from "./SearchHubPage";

const resultPageSize = 15;
const archiveYears = [2026, 2025, 2024, 2023] as const;

function Advertisement({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center overflow-hidden border px-7 text-center ${compact ? "min-h-64 border-[#c89538] bg-[#f4d486] py-10 text-[#4b3017]" : "min-h-[44rem] border-[#1f4d53] bg-[#2d6970] py-14 text-white"}`}>
      <div>
        <p className={`text-[0.65rem] font-semibold uppercase tracking-[0.28em] ${compact ? "text-[#70471d]" : "text-[#c9eef0]"}`}>The weekend edit</p>
        <p className={`font-editorial mt-4 leading-none ${compact ? "text-5xl" : "text-4xl"}`}>Travel beautifully.</p>
        <p className={`mx-auto mt-4 max-w-xs text-sm leading-6 ${compact ? "text-[#5e3a18]" : "text-[#e1f4f5]"}`}>Discover extraordinary stays, remarkable views, and a little more time for yourself.</p>
        <span className={`mt-7 inline-block border px-5 py-3 text-[0.65rem] font-bold uppercase tracking-[0.16em] ${compact ? "border-[#4b3017]" : "border-white"}`}>Explore now</span>
      </div>
    </div>
  );
}

type CursorPaginationProps = {
  currentPage: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadedPageCount: number;
  onNext: () => void;
  onPageChange: (page: number) => void;
  onPrevious: () => void;
};

function CursorPagination({
  currentPage,
  hasNextPage,
  isFetchingNextPage,
  loadedPageCount,
  onNext,
  onPageChange,
  onPrevious,
}: CursorPaginationProps) {
  const isLastLoadedPage = currentPage === loadedPageCount;

  return (
    <nav aria-label="Search result pages" className="mt-10 flex justify-center gap-2 text-xs">
      <button aria-label="Previous page" className="size-9 border border-[#c9aaa1] bg-white hover:border-[#7a1f3d] disabled:opacity-30" disabled={currentPage === 1 || isFetchingNextPage} onClick={onPrevious} type="button">‹</button>
      {Array.from({ length: loadedPageCount }, (_, index) => index + 1).map((page) => (
        <button aria-current={page === currentPage ? "page" : undefined} className={`size-9 border ${page === currentPage ? "border-[#7a1f3d] bg-[#7a1f3d] text-white" : "border-[#c9aaa1] bg-white hover:border-[#7a1f3d]"}`} key={page} onClick={() => onPageChange(page)} type="button">{page}</button>
      ))}
      <button aria-label="Next page" className="size-9 border border-[#c9aaa1] bg-white hover:border-[#7a1f3d] disabled:opacity-30" disabled={(isLastLoadedPage && !hasNextPage) || isFetchingNextPage} onClick={onNext} type="button">{isFetchingNextPage ? "…" : "›"}</button>
    </nav>
  );
}

export function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const celebrity = searchParams.get("celebrity")?.trim() ?? "";
  const hasSearchQuery = searchParams.has("q") && Boolean(celebrity);
  const [searchValue, setSearchValue] = useState(celebrity);
  const [eventFilter, setEventFilter] = useState<CanonicalEventId | "">("");
  const [yearFilter, setYearFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const searchQuery = useCelebritySearch({
    event: eventFilter || undefined,
    limit: resultPageSize,
    query: celebrity,
    year: yearFilter ? Number(yearFilter) : undefined,
  }, hasSearchQuery);
  const loadedPages = searchQuery.data?.pages ?? [];
  const currentResponse = loadedPages[currentPage - 1];
  const resolvedCelebrity = currentResponse?.celebrity ?? loadedPages[0]?.celebrity ?? null;

  const availablePhotos = useMemo<DiscoveryImageDetails[]>(() => {
    if (!currentResponse?.celebrity) return [];
    const currentCelebrity = currentResponse.celebrity;
    return currentResponse.items.map((asset) =>
      toDiscoveryImageDetails(asset, currentCelebrity),
    );
  }, [currentResponse]);
  const loadedPhotos = useMemo<DiscoveryImageDetails[]>(() =>
    loadedPages.flatMap((page) => {
      if (!page.celebrity) return [];
      const pageCelebrity = page.celebrity;
      return page.items.map((asset) => toDiscoveryImageDetails(asset, pageCelebrity));
    }), [loadedPages]);
  const selectedImage = loadedPhotos.find(
    (photo) => photo.id === searchParams.get("photo"),
  ) ?? null;

  useEffect(() => {
    setSearchValue(celebrity);
    setEventFilter("");
    setYearFilter("");
    setCurrentPage(1);
  }, [celebrity]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = searchValue.trim();
    if (!nextQuery) return;

    setEventFilter("");
    setYearFilter("");
    setCurrentPage(1);
    setSearchParams({ q: "search_result", celebrity: nextQuery });
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

  function resetResultPage() {
    setCurrentPage(1);
    dismissImage();
  }

  async function showNextPage() {
    dismissImage();
    if (currentPage < loadedPages.length) {
      setCurrentPage((page) => page + 1);
      return;
    }
    if (!searchQuery.hasNextPage) return;

    const result = await searchQuery.fetchNextPage();
    if ((result.data?.pages.length ?? 0) > currentPage) {
      setCurrentPage((page) => page + 1);
    }
  }

  if (!hasSearchQuery) {
    return <SearchHubPage />;
  }

  const resultCount = currentResponse?.total_count ?? 0;
  const displayName = resolvedCelebrity?.displayName ?? celebrity;
  const hasFilters = Boolean(eventFilter || yearFilter);

  return (
    <div className="min-h-screen bg-[#fffaf6] text-neutral-950">
      <section className="border-b border-[#9f6878] bg-[#f5e7e3] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <div className="mx-auto max-w-[92rem]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7a1f3d]">Celebrity image archive</p>
          <div className="mt-3 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-editorial text-5xl leading-none tracking-[-0.035em] sm:text-7xl">Results for <span className="italic">“{displayName}”</span></h1>
              <p aria-live="polite" className="mt-4 text-sm text-neutral-600">{searchQuery.isPending ? "Searching the archive…" : `${resultCount} photographs found`}</p>
            </div>
            <form className="flex h-14 w-full max-w-xl items-center overflow-hidden rounded-full border border-[#b77a8d] bg-white p-1 shadow-[0_10px_26px_rgba(79,31,48,0.12)] transition-shadow focus-within:border-[#7a1f3d] focus-within:ring-2 focus-within:ring-[#7a1f3d]/25" onSubmit={submitSearch} role="search">
              <label className="sr-only" htmlFor="archive-search">Search the image archive</label>
              <span aria-hidden="true" className="ml-4 text-xl text-[#7a1f3d]">⌕</span>
              <input autoComplete="off" className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#7d6b70]" id="archive-search" name="celebrity" onChange={(event) => setSearchValue(event.target.value)} placeholder="Search a celebrity…" required type="search" value={searchValue} />
              <button className="h-full shrink-0 rounded-full bg-[#7a1f3d] px-6 text-xs font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#59142b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f3d]" type="submit">Search</button>
            </form>
          </div>
        </div>
      </section>

      <div className="sticky top-0 z-20 border-b border-[#d7bbb2] bg-[#fffaf6]/95 px-5 backdrop-blur sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[92rem] flex-wrap items-center gap-3 py-5 sm:gap-5">
          <span className="mr-2 text-xs font-bold uppercase tracking-[0.18em]">Filter by</span>
          <label className="relative">
            <span className="sr-only">Event</span>
            <select className="min-w-44 appearance-none rounded-full border border-[#8f4560] bg-white py-2.5 pl-5 pr-11 text-sm font-semibold text-neutral-950 outline-offset-4" onChange={(event) => { setEventFilter(event.target.value as CanonicalEventId | ""); resetResultPage(); }} value={eventFilter}>
              <option value="">All events</option>
              {canonicalEventIds.map((eventId) => <option key={eventId} value={eventId}>{canonicalEventNames[eventId]}</option>)}
            </select>
            <span aria-hidden="true" className="pointer-events-none absolute right-4 top-2.5">⌄</span>
          </label>
          <label className="relative">
            <span className="sr-only">Year</span>
            <select className="min-w-36 appearance-none rounded-full border border-[#8f4560] bg-white py-2.5 pl-5 pr-11 text-sm font-semibold text-neutral-950 outline-offset-4" onChange={(event) => { setYearFilter(event.target.value); resetResultPage(); }} value={yearFilter}>
              <option value="">All years</option>
              {archiveYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <span aria-hidden="true" className="pointer-events-none absolute right-4 top-2.5">⌄</span>
          </label>
          {hasFilters && <button className="ml-auto text-xs font-bold uppercase tracking-[0.12em] underline underline-offset-4" onClick={() => { setEventFilter(""); setYearFilter(""); resetResultPage(); }} type="button">Clear filters</button>}
        </div>
      </div>

      <main className="mx-auto max-w-[92rem] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        {searchQuery.isPending ? (
          <div className="py-24 text-center" role="status"><h2 className="font-editorial text-5xl">Searching the archive…</h2><p className="mt-4 text-neutral-600">Finding approved photographs for {celebrity}.</p></div>
        ) : searchQuery.isError ? (
          <div className="py-24 text-center"><h2 className="font-editorial text-5xl">Search unavailable</h2><p className="mx-auto mt-4 max-w-xl text-neutral-600">{searchQuery.error instanceof Error ? searchQuery.error.message : "The archive could not be searched."}</p><button className="mt-6 rounded-full border border-[#7a1f3d] bg-white px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#7a1f3d]" onClick={() => void searchQuery.refetch()} type="button">Try again</button></div>
        ) : !resolvedCelebrity ? (
          <div className="py-24 text-center"><h2 className="font-editorial text-5xl">No celebrity found</h2><p className="mt-4 text-neutral-600">Try the celebrity’s full name or a known alias.</p></div>
        ) : availablePhotos.length ? (
          <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_16rem] xl:gap-8">
            <div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
                {availablePhotos.map((photo, index) => (
                  <Fragment key={photo.id}>
                    <DiscoveryImageCard details={photo} onOpen={openImage}>
                      <div className="mt-4 flex items-start justify-between gap-4 border-t border-neutral-950 pt-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em]">{photo.eventName ?? "Archive"}</p><p className="mt-2 text-base leading-snug">{photo.caption ?? photo.title ?? `${photo.celebrityName} archive photograph`}</p></div><time className="text-sm tabular-nums text-neutral-600">{photo.year ?? "—"}</time></div>
                    </DiscoveryImageCard>
                    {index === 5 && <aside aria-label="Advertisement" className="col-span-full border-y border-neutral-300 py-10"><p className="mb-5 text-center text-[0.65rem] uppercase tracking-[0.25em] text-neutral-500">Advertisement</p><Advertisement compact /></aside>}
                  </Fragment>
                ))}
              </div>
              {(loadedPages.length > 1 || searchQuery.hasNextPage) && (
                <CursorPagination currentPage={currentPage} hasNextPage={Boolean(searchQuery.hasNextPage)} isFetchingNextPage={searchQuery.isFetchingNextPage} loadedPageCount={loadedPages.length} onNext={() => void showNextPage()} onPageChange={(page) => { dismissImage(); setCurrentPage(page); }} onPrevious={() => { dismissImage(); setCurrentPage((page) => Math.max(1, page - 1)); }} />
              )}
            </div>
            <aside aria-label="Advertisement" className="sticky top-24 hidden xl:block"><p className="mb-4 text-center text-[0.65rem] uppercase tracking-[0.25em] text-neutral-500">Advertisement</p><Advertisement /></aside>
          </div>
        ) : (
          <div className="py-24 text-center"><h2 className="font-editorial text-5xl">No photographs found</h2><p className="mt-4 text-neutral-600">{hasFilters ? "Try clearing one of the filters." : "No approved photographs are available yet."}</p></div>
        )}
      </main>
      <DiscoveryImageDialog details={selectedImage} onDismiss={dismissImage} />
    </div>
  );
}
