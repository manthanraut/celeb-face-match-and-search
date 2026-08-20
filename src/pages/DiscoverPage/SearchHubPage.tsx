import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useDiscoveryHub } from "../../features/search/hooks";
import { DiscoveryImageCard } from "./DiscoveryImageCard";
import { DiscoveryImageDialog } from "./DiscoveryImageDialog";
import {
  toDiscoveryImageDetails,
  type DiscoveryImageDetails,
} from "./discoveryImageDetails";

export function SearchHubPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [showMorePeople, setShowMorePeople] = useState(false);
  const hubQuery = useDiscoveryHub(10);
  const people = hubQuery.data?.people ?? [];
  const results = useMemo<DiscoveryImageDetails[]>(() =>
    (hubQuery.data?.people ?? []).map(({ celebrity, representativeImage }) =>
      toDiscoveryImageDetails(representativeImage, celebrity),
    ), [hubQuery.data?.people]);
  const selectedImage = results.find(
    (result) => result.id === searchParams.get("photo"),
  ) ?? null;
  const leadingResults = results.slice(0, 6);
  const trailingResults = results.slice(6);

  function selectCelebrity(name: string) {
    navigate(`/discover/?q=search_result&celebrity=${encodeURIComponent(name)}`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) return;

    selectCelebrity(nextQuery);
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
          <h1 className="font-editorial text-2xl font-light leading-8" id="discover-title">Discover the Celebrity Image Archive</h1>
        </div>
        <p className="font-vogue-sans mx-auto mt-4 max-w-5xl text-[0.8125rem] leading-[1.3125rem]">Search by name to explore approved photographs from iconic events and unforgettable moments.</p>
        <form className="relative mx-auto mt-6 flex h-14 w-full max-w-3xl items-center overflow-hidden rounded-full border border-[#b77a8d] bg-white p-1 shadow-[0_12px_30px_rgba(79,31,48,0.12)] transition-shadow focus-within:border-[#7a1f3d] focus-within:ring-2 focus-within:ring-[#7a1f3d]/25" onSubmit={submit} role="search">
          <label className="sr-only" htmlFor="hub-search">Search the image archive</label>
          <svg aria-hidden="true" className="ml-4 size-6 shrink-0 text-[#7a1f3d]" fill="none" viewBox="0 0 32 32"><path d="M24.5 14c0 5.799-4.701 10.5-10.5 10.5S3.5 19.799 3.5 14 8.201 3.5 14 3.5 24.5 8.201 24.5 14Zm-3.071 7.429L29 29" stroke="currentColor" strokeWidth="1.5"/></svg>
          <input autoComplete="off" className="font-vogue-sans min-w-0 flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-[#7d6b70]" id="hub-search" name="celebrity" onChange={(event) => setQuery(event.target.value)} placeholder="Search a celebrity…" required type="search" value={query} />
          <button className="h-full shrink-0 rounded-full bg-[#7a1f3d] px-6 text-xs font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#59142b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f3d]" type="submit">Search</button>
        </form>
      </section>

      <section className="border border-[#e2d8d3] bg-[#faf8f6] px-5 py-5 sm:px-7" aria-labelledby="people-title">
        <h2 className="font-editorial text-2xl" id="people-title">People</h2>
        {hubQuery.isPending ? (
          <p className="mt-4 min-h-24 py-8 text-sm text-neutral-600" role="status">Loading searchable people…</p>
        ) : hubQuery.isError ? (
          <p className="mt-4 min-h-24 py-8 text-sm text-neutral-600">People could not be loaded.</p>
        ) : people.length ? (
          <div className="mt-4 flex gap-5 overflow-x-auto pb-1 sm:gap-8">
            {people.slice(0, showMorePeople ? people.length : 3).map((person) => (
              <button className="w-20 shrink-0 text-center" key={person.celebrity.slug} onClick={() => selectCelebrity(person.celebrity.displayName)} type="button">
                <img alt={person.representativeImage.sourceText.altText ?? `${person.celebrity.displayName} archive photograph`} className="mx-auto size-16 rounded-full border-2 border-white object-cover p-0.5 shadow-sm" decoding="async" height="64" loading="lazy" src={person.representativeImage.links.image} width="64" />
                <span className="font-editorial mt-2 flex h-8 items-start justify-center text-sm leading-4">{person.celebrity.displayName}</span>
                <span className="mt-0.5 block text-[0.62rem] text-neutral-500">{person.total_count} photos</span>
              </button>
            ))}
            {people.length > 3 && (
              <button aria-expanded={showMorePeople} className="w-20 shrink-0 text-center" onClick={() => setShowMorePeople((current) => !current)} type="button">
                <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#7a1f3d] text-sm font-bold text-white">{showMorePeople ? "−" : `+${people.length - 3}`}</span>
                <span className="font-editorial mt-2 flex h-8 items-start justify-center text-sm leading-4">{showMorePeople ? "Show less" : "More people"}</span>
                <span className="mt-0.5 block text-[0.62rem] text-neutral-500">{showMorePeople ? "Collapse" : "View all"}</span>
              </button>
            )}
          </div>
        ) : (
          <p className="mt-4 min-h-24 py-8 text-sm text-neutral-600">No searchable people are available yet.</p>
        )}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(12rem,1fr)]">
        <section aria-labelledby="hub-results-title">
          <h2 className="sr-only" id="hub-results-title">Featured archive photographs</h2>
          {hubQuery.isPending ? (
            <div className="py-24 text-center" role="status"><h3 className="font-editorial text-4xl">Loading the archive…</h3></div>
          ) : hubQuery.isError ? (
            <div className="py-24 text-center"><h3 className="font-editorial text-4xl">Archive unavailable</h3><p className="mx-auto mt-4 max-w-xl text-neutral-600">{hubQuery.error instanceof Error ? hubQuery.error.message : "The discovery archive could not be loaded."}</p><button className="mt-6 rounded-full border border-[#7a1f3d] px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#7a1f3d]" onClick={() => void hubQuery.refetch()} type="button">Try again</button></div>
          ) : leadingResults.length ? (
            <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
              {leadingResults.map((result) => (
                <DiscoveryImageCard details={result} imageClassName="object-[center_28%]" key={result.id} onOpen={openImage}>
                  <h3 className="font-editorial mt-2 text-xl leading-none">{result.celebrityName}</h3>
                  <p className="mt-1 text-xs text-neutral-600">{result.eventName ?? "Archive"}{result.year ? ` · ${result.year}` : ""}</p>
                </DiscoveryImageCard>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center"><h3 className="font-editorial text-4xl">No photographs available</h3><p className="mt-4 text-neutral-600">Approved archive photographs will appear here.</p></div>
          )}
        </section>
        <aside aria-label="Advertising" className="border-t border-[#cfada1] pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"><div className="sticky top-6"><p className="font-vogue-sans text-center text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-[#355f63]">Advertisement</p><div className="mt-3 flex aspect-[4/5] items-center justify-center border border-[#1f4d53] bg-[#2d6970] px-5 text-center text-white"><p className="font-editorial text-xl">Your ad here</p></div></div></aside>
      </div>

      {trailingResults.length > 0 && (
        <>
          <aside aria-label="Sponsored content" className="mt-8 border-y border-[#c89538] bg-[#f4d486] px-6 py-10 text-center text-[#4b3017] lg:py-14"><p className="font-vogue-sans text-[0.55rem] font-semibold uppercase tracking-[0.16em]">Advertisement</p><p className="font-editorial mt-4 text-2xl">Mid-content sponsored placement</p></aside>
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(12rem,1fr)]">
            <section aria-label="More featured archive photographs" className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
              {trailingResults.map((result) => (
                <DiscoveryImageCard details={result} imageClassName="object-[center_28%]" key={result.id} onOpen={openImage}>
                  <h3 className="font-editorial mt-2 text-xl leading-none">{result.celebrityName}</h3>
                  <p className="mt-1 text-xs text-neutral-600">{result.eventName ?? "Archive"}{result.year ? ` · ${result.year}` : ""}</p>
                </DiscoveryImageCard>
              ))}
            </section>
          </div>
        </>
      )}
      <DiscoveryImageDialog details={selectedImage} onDismiss={dismissImage} />
    </div>
  );
}
