import { useEffect, useRef, type MouseEvent } from "react";

import type { DiscoveryImageDetails } from "./discoveryImageDetails.js";

type DiscoveryImageDialogProps = {
  details: DiscoveryImageDetails | null;
  onDismiss: () => void;
};

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

export function DiscoveryImageDialog({
  details,
  onDismiss,
}: DiscoveryImageDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (details && !dialog.open) {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
      return;
    }

    if (!details && dialog.open) dialog.close();
  }, [details]);

  useEffect(() => {
    if (!details) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [details]);

  function closeDialog() {
    dialogRef.current?.close();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeDialog();
  }

  function handleClosed() {
    onDismiss();
    const restoreTarget = restoreFocusRef.current;
    restoreFocusRef.current = null;
    queueMicrotask(() => restoreTarget?.focus());
  }

  return (
    <dialog
      aria-describedby="discovery-image-description"
      aria-labelledby="discovery-image-title"
      className="m-0 h-dvh max-h-dvh w-full max-w-none overflow-hidden bg-white p-0 text-neutral-950 backdrop:bg-black/75 sm:m-auto sm:h-[calc(100dvh-2rem)] sm:max-h-[48rem] sm:w-[min(67.5rem,calc(100%-2rem))] sm:rounded-sm"
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onClick={handleBackdropClick}
      onClose={handleClosed}
      ref={dialogRef}
    >
      {details ? (
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,42dvh)_minmax(0,1fr)] bg-white md:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)] md:grid-rows-1">
          <div className="flex min-h-0 items-center justify-center bg-neutral-950">
            <img
              alt={details.altText}
              className="h-full w-full object-contain"
              decoding="async"
              height="1500"
              src={details.imageUrl}
              width="1200"
            />
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-neutral-200 bg-white px-6 py-5 sm:px-8">
              <div className="min-w-0">
                <p className="font-vogue-sans text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  Image details
                </p>
                <h2
                  className="font-editorial mt-2 break-words text-4xl leading-none text-balance"
                  id="discovery-image-title"
                >
                  {details.celebrityName}
                </h2>
              </div>
              <button
                aria-label="Close image details"
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white transition-colors hover:border-neutral-950 hover:bg-neutral-950 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                onClick={closeDialog}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  className="size-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 5l14 14M19 5 5 19"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.75"
                  />
                </svg>
              </button>
            </header>

            <div className="px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-7 sm:px-8">
              <p className="sr-only" id="discovery-image-description">
                Editorial and archive context for this image.
              </p>

              <dl className="grid grid-cols-2 gap-6 border-b border-neutral-300 pb-7">
                <div>
                  <dt className="font-vogue-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Event
                  </dt>
                  <dd className="font-editorial mt-2 break-words text-2xl">
                    {details.eventName ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-vogue-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Year
                  </dt>
                  <dd className="font-editorial mt-2 text-2xl tabular-nums">
                    {details.year ?? "—"}
                  </dd>
                </div>
              </dl>

              <section
                aria-labelledby="featured-in-title"
                className="border-b border-neutral-300 py-7"
              >
                <h3
                  className="font-vogue-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-neutral-500"
                  id="featured-in-title"
                >
                  Featured In
                </h3>
                {details.featuredIn.length ? (
                  <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
                    {details.featuredIn.slice(0, 2).map((item) => (
                      <li key={`${item.url}:${item.title}`}>
                        <a
                          className="group/link flex min-h-14 items-center justify-between gap-4 py-3 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                          href={item.url}
                          rel={isExternalUrl(item.url) ? "noreferrer" : undefined}
                          target={isExternalUrl(item.url) ? "_blank" : undefined}
                        >
                          <span className="min-w-0 break-words">{item.title}</span>
                          {isExternalUrl(item.url) ? (
                            <span className="sr-only"> (opens in a new tab)</span>
                          ) : null}
                          <span
                            aria-hidden="true"
                            className="shrink-0 transition-transform group-hover/link:translate-x-1 motion-reduce:transition-none"
                          >
                            ↗
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-neutral-600">
                    No linked content has been added yet.
                  </p>
                )}
              </section>

              <section aria-labelledby="backstory-title" className="pt-7">
                <h3
                  className="font-vogue-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-neutral-500"
                  id="backstory-title"
                >
                  Backstory
                </h3>
                <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-pretty text-neutral-700">
                  {details.backStory ??
                    "No editorial backstory has been added for this image."}
                </p>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
