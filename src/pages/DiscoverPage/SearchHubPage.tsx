import { FormEvent, Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { sampleArchiveImages } from "../../data/sampleArchive";

type Result = { id: string; name: string; event: string; year: number | null; image: string };
const pageSize = 15;

const results: Result[] = sampleArchiveImages.flatMap((image) => {
  if (!image.enrichment_state.search_ready) return [];
  const usage = image.usages[0];
  return image.celebrities.filter((celebrity) => celebrity.status === "Approved").map((celebrity) => ({
    id: image.image_id,
    name: celebrity.canonical_name,
    event: usage?.event.event_name ?? "Archive",
    year: usage?.event.year ?? null,
    image: image.image_url,
  }));
});

const people = Array.from(new Map(results.map((result) => [result.name, { name: result.name, image: result.image }])).values());

function Heart({ filled = false }: { filled?: boolean }) {
  return <span aria-hidden="true">{filled ? "♥" : "♡"}</span>;
}

export function SearchHubPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("Tracee Ellis Ross");
  const [saved, setSaved] = useState<Set<string>>(new Set(["img_002"]));
  const [showMorePeople, setShowMorePeople] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const celebrityResults = useMemo(() => {
    const normalizedQuery = submittedQuery.trim().toLocaleLowerCase();
    return results.filter((item) => item.name.toLocaleLowerCase() === normalizedQuery);
  }, [submittedQuery]);
  const pageCount = Math.ceil(celebrityResults.length / pageSize);
  const visibleResults = celebrityResults.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

  function toggleSaved(id: string) {
    setSaved((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-[100rem] px-5 pb-24 sm:px-8 lg:px-12">
      <section className="pb-9 pt-12 text-center sm:pt-[3.65rem]" aria-labelledby="discover-title">
        <div className="relative">
          <h1 className="font-editorial text-2xl font-light leading-8" id="discover-title">Search the Image Archive</h1>
          <a className="absolute right-0 top-1/2 hidden -translate-y-1/2 items-center gap-2 border border-neutral-950 px-4 py-3 text-xs font-bold xl:flex" href="/bookmarks"><Heart /> Saved {saved.size}</a>
        </div>
        <p className="font-vogue-sans mx-auto mt-4 max-w-5xl text-[0.8125rem] leading-[1.3125rem]">To get specific results from this AI-powered search, try descriptive searches including colors, fabrics, and features.</p>
        <form className="relative mx-auto mt-[1.35rem] flex h-12 w-full border-[0.5px] border-[#e0e0e0] md:w-[50vw]" onSubmit={submit}>
          <label className="sr-only" htmlFor="hub-search">Search the image archive</label>
          <svg aria-hidden="true" className="ml-4 size-8 shrink-0 self-center" fill="none" viewBox="0 0 32 32"><path d="M24.5 14c0 5.799-4.701 10.5-10.5 10.5S3.5 19.799 3.5 14 8.201 3.5 14 3.5 24.5 8.201 24.5 14Zm-3.071 7.429L29 29" stroke="currentColor" strokeWidth="1.25"/></svg>
          <input className="font-vogue-sans min-w-0 flex-1 px-4 text-[0.8125rem] outline-none placeholder:text-[#6f6f6f]" id="hub-search" onChange={(event) => setQuery(event.target.value)} placeholder={'Try searching "Tracee Ellis Ross"'} value={query} />
          <button className="sr-only" type="submit">Search</button>
        </form>
        <div className="font-vogue-sans mt-[1.05rem] flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[0.75rem] leading-5">
          <span className="font-medium">Trending:</span>
          {["Tracee Ellis Ross", "Emilia Clarke", "Catherine"].map((term) => <button className={`uppercase tracking-[0.15em] underline-offset-4 hover:underline ${submittedQuery === term ? "font-semibold underline" : "font-medium"}`} key={term} onClick={() => selectCelebrity(term)} type="button">{term}</button>)}
        </div>
      </section>

      <section className="border border-[#ddd9d3] bg-[#f5f3f0] px-5 py-5 sm:px-7" aria-labelledby="people-title">
        <div className="flex items-baseline justify-between gap-4"><h2 className="font-editorial text-2xl" id="people-title">People</h2><p className="hidden text-[0.68rem] text-neutral-500 sm:block">Select a face to see every photo they’re in</p></div>
        <div className="mt-4 flex gap-5 overflow-x-auto pb-1 sm:gap-8">
          {people.slice(0, showMorePeople ? people.length : 3).map((person) => (
            <button aria-pressed={submittedQuery === person.name} className="w-20 shrink-0 text-center" key={person.name} onClick={() => selectCelebrity(person.name)} type="button">
              <img alt={person.name} className={`mx-auto size-16 rounded-full object-cover p-0.5 grayscale ${submittedQuery === person.name ? "border-2 border-neutral-950" : "border border-neutral-400"}`} src={person.image} />
              <span className="font-editorial mt-2 flex h-8 items-start justify-center text-sm leading-4">{person.name}</span>
              <span className="mt-0.5 block text-[0.62rem] text-neutral-500">{results.filter((result) => result.name === person.name).length} photos</span>
            </button>
          ))}
          <button aria-expanded={showMorePeople} className="w-20 shrink-0 text-center" onClick={() => setShowMorePeople((current) => !current)} type="button">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white">{showMorePeople ? "−" : `+${people.length - 3}`}</span>
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
                {index === 6 && <aside aria-label="Sponsored content" className="relative z-10 border-y border-neutral-200 bg-[#f5f5f5] px-6 py-10 text-center sm:col-span-2 lg:col-span-3 lg:w-[calc(125%+2rem)] lg:py-14"><p className="font-vogue-sans text-[0.55rem] uppercase tracking-[0.16em] text-neutral-500">Advertisement</p><p className="font-editorial mt-4 text-2xl text-neutral-500">Mid-content sponsored placement</p></aside>}
                <article>
                  <div className="group relative aspect-[4/5] overflow-hidden bg-neutral-200"><img alt={`${result.name} at the ${result.event}`} className="h-full w-full object-cover object-[center_28%] grayscale transition duration-500 group-hover:scale-[1.02]" loading="lazy" src={result.image} /><button aria-label={`${saved.has(result.id) ? "Remove" : "Save"} ${result.name} photo`} className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white text-xl shadow-sm" onClick={() => toggleSaved(result.id)} type="button"><Heart filled={saved.has(result.id)} /></button></div>
                  <h3 className="font-editorial mt-2 text-xl leading-none">{result.name}</h3><p className="mt-1 text-xs text-neutral-600">{result.event}{result.year ? ` · ${result.year}` : ""}</p>
                </article>
              </Fragment>
            ))}
          </div>
          {visibleResults.length > 0 && <nav aria-label="Search result pages" className="mt-10 flex justify-center gap-2 text-xs"><button aria-label="Previous page" className="size-9 border border-neutral-300 disabled:opacity-30" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} type="button">‹</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button aria-current={page === currentPage ? "page" : undefined} className={`size-9 border ${page === currentPage ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-300"}`} key={page} onClick={() => setCurrentPage(page)} type="button">{page}</button>)}<button aria-label="Next page" className="size-9 border border-neutral-300 disabled:opacity-30" disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} type="button">›</button></nav>}
        </section>
        <aside aria-label="Advertising" className="border-t border-neutral-200 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"><div className="sticky top-6"><p className="font-vogue-sans text-center text-[0.55rem] uppercase tracking-[0.16em] text-neutral-500">Advertisement</p><div className="mt-3 flex aspect-[4/5] items-center justify-center bg-[#f5f5f5] px-5 text-center"><p className="font-editorial text-xl text-neutral-400">Your ad here</p></div></div></aside>
      </div>
    </div>
  );
}
