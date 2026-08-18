function BrandMark() {
  return (
    <div
      aria-hidden="true"
      className="grid size-14 shrink-0 place-items-center bg-[linear-gradient(to_bottom,#59cbe8_0_24%,#f3a8bb_24%_43%,#f7f7f7_43%_62%,#f3a8bb_62%_81%,#59cbe8_81%_100%)]"
    >
      <span className="font-editorial text-2xl leading-none text-neutral-600/80">O</span>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <circle cx="10.75" cy="10.75" r="6.75" stroke="currentColor" strokeWidth="2.4" />
      <path d="m16 16 4.25 4.25" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19">
      <path d="M12 4v16M4 12h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.55v-.1a1.7 1.7 0 0 0-.4-1.1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 3.75 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9.55h.1a1.7 1.7 0 0 0 1.1-.4 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.86-2.86.06.06A1.7 1.7 0 0 0 8.2 3.75a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4.05v.1a1.7 1.7 0 0 0 .4 1.1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06a1.7 1.7 0 0 0-.34 1.88c.12.4.33.75.6 1 .3.27.68.4 1.1.4h.1v4.05h-.1c-.42 0-.8.13-1.1.4-.27.25-.48.6-.6 1Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.65"
      />
    </svg>
  );
}

export function AdminHeader() {
  return (
    <header className="border-b border-neutral-300 bg-white">
      <div className="flex h-14 items-center">
        <BrandMark />

        <div className="flex min-w-0 flex-1 items-center gap-4 px-4">
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="font-editorial text-2xl font-bold leading-none tracking-[-0.07em]"
              translate="no"
            >
              allure
            </span>
            <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 18 18" width="14">
              <path d="m4 7 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </div>

          <div className="hidden h-10 min-w-0 max-w-[36rem] flex-1 items-center gap-2 rounded-md border border-neutral-300 px-3 text-neutral-500 lg:flex">
            <SearchIcon />
            <span className="truncate text-base">Search for articles, galleries, and more</span>
          </div>

          <div aria-hidden="true" className="ml-auto flex shrink-0 items-center gap-4 text-neutral-900 sm:gap-5">
            <span className="hidden min-h-10 items-center gap-2 rounded-md border border-neutral-300 px-4 text-base font-bold md:inline-flex">
              <PlusIcon />
              Create
            </span>
            <span className="hidden sm:inline-flex">
              <SettingsIcon />
            </span>
            <span className="hidden text-xl font-semibold md:inline">?</span>
            <span className="grid size-9 place-items-center rounded-full bg-neutral-900 text-xs font-bold text-white">
              MR
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
