import { Fragment, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { sampleArchiveImages } from "../../data/sampleArchive";
import { DiscoveryImageCard } from "./DiscoveryImageCard";
import { DiscoveryImageDialog } from "./DiscoveryImageDialog";
import {
  toDiscoveryImageDetails,
  type DiscoveryImageDetails,
} from "./discoveryImageDetails";

const pageSize = 15;

const results: DiscoveryImageDetails[] = sampleArchiveImages.flatMap((image) => {
  if (!image.enrichment_state.search_ready) return [];
  return image.celebrities
    .filter((celebrity) => celebrity.status === "Approved")
    .map((celebrity) => toDiscoveryImageDetails(image, celebrity));
});

const people = Array.from(
  new Map(
    results.map((result) => [
      result.celebrityName,
      { image: result.imageUrl, name: result.celebrityName },
    ]),
  ).values(),
);

export function SearchHubPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("Tracee Ellis Ross");
  const [showMorePeople, setShowMorePeople] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const celebrityResults = useMemo(() => {
    const normalizedQuery = submittedQuery.trim().toLocaleLowerCase();
    return results.filter(
      (item) => item.celebrityName.toLocaleLowerCase() === normalizedQuery,
    );
  }, [submittedQuery]);
  const pageCount = Math.ceil(celebrityResults.length / pageSize);
  const visibleResults = celebrityResults.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedImage = celebrityResults.find(
    (result) => result.id === searchParams.get("photo"),
  ) ?? null;

  function selectCelebrity(name: string) {
    setQuery(name);
    setSubmittedQuery(name);
    setCurrentPage(1);
    navigate(`/discover/?q=search_result&celebrity=${encodeURIComponent(name)}`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextQuery = query.trim() || "Tracee Ellis Ross";
    setSubmittedQuery(nextQuery);
    setCurrentPage(1);
    navigate(`/discover/?q=search_result&celebrity=${encodeURIComponent(nextQuery)}`);
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

  return (
    <div className="mx-auto max-w-[100rem] bg-white px-5 pb-24 text-neutral-950 sm:px-8 lg:px-12">
      <section className="-mx-5 border-b border-[#e2d8d3] bg-white px-5 pb-10 pt-12 text-center sm:-mx-8 sm:px-8 sm:pt-[3.65rem] lg:-mx-12 lg:px-12" aria-labelledby="discover-title">
        <div>
          <h1 className="font-editorial text-2xl font-light leading-8" id="discover-title">Search the Image Archive</h1>
        </div>
        <p className="font-vogue-sans mx-auto mt-4 max-w-5xl text-[0.8125rem] leading-[1.3125rem]">To get specific results from this AI-powered search, try descriptive searches including colors, fabrics, and features.</p>
        <form className="relative mx-auto mt-6 flex h-14 w-full max-w-3xl items-center overflow-hidden rounded-full border border-[#b77a8d] bg-white p-1 shadow-[0_12px_30px_rgba(79,31,48,0.12)] transition-shadow focus-within:border-[#7a1f3d] focus-within:ring-2 focus-within:ring-[#7a1f3d]/25" onSubmit={submit} role="search">
          <label className="sr-only" htmlFor="hub-search">Search the image archive</label>
          <svg aria-hidden="true" className="ml-4 size-6 shrink-0 text-[#7a1f3d]" fill="none" viewBox="0 0 32 32"><path d="M24.5 14c0 5.799-4.701 10.5-10.5 10.5S3.5 19.799 3.5 14 8.201 3.5 14 3.5 24.5 8.201 24.5 14Zm-3.071 7.429L29 29" stroke="currentColor" strokeWidth="1.5"/></svg>
          <input autoComplete="off" className="font-vogue-sans min-w-0 flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-[#7d6b70]" id="hub-search" name="celebrity" onChange={(event) => setQuery(event.target.value)} placeholder="Try searching “Tracee Ellis Ross”…" type="search" value={query} />
          <button className="h-full shrink-0 rounded-full bg-[#7a1f3d] px-6 text-xs font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#59142b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f3d]" type="submit">Search</button>
        </form>
        <div className="font-vogue-sans mt-[1.05rem] flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[0.75rem] leading-5">
          <span className="font-medium">Trending:</span>
          {["Tracee Ellis Ross", "Emilia Clarke", "Catherine"].map((term) => <button className={`uppercase tracking-[0.15em] underline-offset-4 hover:text-[#7a1f3d] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f3d] ${submittedQuery === term ? "font-semibold text-[#7a1f3d] underline" : "font-medium"}`} key={term} onClick={() => selectCelebrity(term)} type="button">{term}</button>)}
        </div>
      </section>

      <section className="border border-[#e2d8d3] bg-[#faf8f6] px-5 py-5 sm:px-7" aria-labelledby="people-title">
        <div className="flex items-baseline justify-between gap-4"><h2 className="font-editorial text-2xl" id="people-title">People</h2><p className="hidden text-[0.68rem] text-neutral-500 sm:block">Select a face to see every photo they’re in</p></div>
        <div className="mt-4 flex gap-5 overflow-x-auto pb-1 sm:gap-8">
          {people.slice(0, showMorePeople ? people.length : 3).map((person) => (
            <button aria-pressed={submittedQuery === person.name} className="w-20 shrink-0 text-center" key={person.name} onClick={() => selectCelebrity(person.name)} type="button">
              <img alt={person.name} className={`mx-auto size-16 rounded-full object-cover p-0.5 shadow-sm ${submittedQuery === person.name ? "border-2 border-[#7a1f3d]" : "border-2 border-white"}`} decoding="async" height="64" loading="lazy" src={person.image} width="64" />
              <span className="font-editorial mt-2 flex h-8 items-start justify-center text-sm leading-4">{person.name}</span>
              <span className="mt-0.5 block text-[0.62rem] text-neutral-500">{results.filter((result) => result.celebrityName === person.name).length} photos</span>
            </button>
          ))}
          <button aria-expanded={showMorePeople} className="w-20 shrink-0 text-center" onClick={() => setShowMorePeople((current) => !current)} type="button">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#7a1f3d] text-sm font-bold text-white">{showMorePeople ? "−" : `+${people.length - 3}`}</span>
            <span className="font-editorial mt-2 flex h-8 items-start justify-center text-sm leading-4">{showMorePeople ? "Show less" : "More people"}</span>
            <span className="mt-0.5 block text-[0.62rem] text-neutral-500">{showMorePeople ? "Collapse" : "View all"}</span>
          </button>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(12rem,1fr)]">
        <section aria-labelledby="hub-results-title">
          <h2 className="sr-only" id="hub-results-title">Search results</h2>
          <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {visibleResults.map((result, index) => (
              <Fragment key={result.id}>
                {index === 6 && <aside aria-label="Sponsored content" className="relative z-10 border-y border-[#c89538] bg-[#f4d486] px-6 py-10 text-center text-[#4b3017] sm:col-span-2 lg:col-span-3 lg:w-[calc(125%+2rem)] lg:py-14"><p className="font-vogue-sans text-[0.55rem] font-semibold uppercase tracking-[0.16em]">Advertisement</p><p className="font-editorial mt-4 text-2xl">Mid-content sponsored placement</p></aside>}
                <DiscoveryImageCard
                  details={result}
                  imageClassName="object-[center_28%]"
                  onOpen={openImage}
                >
                  <h3 className="font-editorial mt-2 text-xl leading-none">
                    {result.celebrityName}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-600">
                    {result.eventName ?? "Archive"}
                    {result.year ? ` · ${result.year}` : ""}
                  </p>
                </DiscoveryImageCard>
              </Fragment>
            ))}
          </div>
          {visibleResults.length > 0 && <nav aria-label="Search result pages" className="mt-10 flex justify-center gap-2 text-xs"><button aria-label="Previous page" className="size-9 border border-[#c9aaa1] bg-white hover:border-[#7a1f3d] disabled:opacity-30" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} type="button">‹</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button aria-current={page === currentPage ? "page" : undefined} className={`size-9 border ${page === currentPage ? "border-[#7a1f3d] bg-[#7a1f3d] text-white" : "border-[#c9aaa1] bg-white hover:border-[#7a1f3d]"}`} key={page} onClick={() => setCurrentPage(page)} type="button">{page}</button>)}<button aria-label="Next page" className="size-9 border border-[#c9aaa1] bg-white hover:border-[#7a1f3d] disabled:opacity-30" disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} type="button">›</button></nav>}
        </section>
        <aside aria-label="Advertising" className="border-t border-[#cfada1] pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"><div className="sticky top-6"><p className="font-vogue-sans text-center text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-[#355f63]">Advertisement</p><div className="mt-3 flex aspect-[4/5] items-center justify-center border border-[#1f4d53] bg-[#2d6970] px-5 text-center text-white"><p className="font-editorial text-xl">Your ad here</p></div></div></aside>
      </div>
      <DiscoveryImageDialog
        details={selectedImage}
        onDismiss={dismissImage}
      />
    </div>
  );
}
