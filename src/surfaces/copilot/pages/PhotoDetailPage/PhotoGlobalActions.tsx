interface PhotoGlobalActionsProps {
  errorMessage: string | null;
  formId: string;
  hasUnsavedChanges: boolean;
  isSaved: boolean;
  isSaving: boolean;
}

export function PhotoGlobalActions({
  errorMessage,
  formId,
  hasUnsavedChanges,
  isSaved,
  isSaving,
}: PhotoGlobalActionsProps) {
  const saveMessage = errorMessage
    ?? (isSaved && !hasUnsavedChanges
      ? "Photo saved. Celebrity decisions were updated using the stored AWS result."
      : "");

  return (
    <aside
      aria-label="Photo actions"
      className="fixed right-5 top-[4.5rem] z-40 flex items-stretch rounded-md bg-white p-2 shadow-[0_4px_18px_rgb(0_0_0/0.28)] sm:right-7"
    >
      {saveMessage ? (
        <p
          aria-live="polite"
          className={`absolute right-0 top-[calc(100%+0.5rem)] w-80 rounded-md border bg-white px-4 py-3 text-sm shadow-lg ${errorMessage ? "border-red-200 text-red-700" : "border-emerald-200 text-emerald-800"}`}
          role="status"
        >
          {saveMessage}
        </p>
      ) : null}

      <button
        className="min-h-12 min-w-24 rounded-md border border-neutral-300 px-5 text-base font-bold text-neutral-900 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2948b8] disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
        disabled={!hasUnsavedChanges || isSaving}
        form={formId}
        type="submit"
      >
        {isSaving ? "Saving…" : "Save"}
      </button>

      <button
        className="ml-2 min-h-12 min-w-24 rounded-md border border-red-300 px-5 text-base font-bold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        type="button"
      >
        Delete
      </button>
    </aside>
  );
}
