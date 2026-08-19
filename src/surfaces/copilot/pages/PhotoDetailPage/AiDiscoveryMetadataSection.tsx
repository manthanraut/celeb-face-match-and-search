import type { AssetDetail } from "../../../../features/assets/contracts";
import type { GalleryEventContext } from "../../../../../shared/galleries";

interface AiDiscoveryMetadataSectionProps {
  asset: AssetDetail;
  eventMetadata: GalleryEventContext | null;
  eventMetadataError: string | null;
  hideFromSearch: boolean;
  isAddingToContent: boolean;
  isEventMetadataLoading: boolean;
  isSaving: boolean;
  onAddToContent: () => void;
  onHideFromSearchChange: (checked: boolean) => void;
}

type Association = AssetDetail["enrichment"]["associations"][number];

const confidenceFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export function formatMatchConfidence(confidence: number | null) {
  return confidence === null ? "N/A" : `${confidenceFormatter.format(confidence)}%`;
}

function formatAnalyzedAt(value: string | null) {
  if (!value) return "Not completed";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function StatusBadge({
  children,
  tone,
}: {
  children: string;
  tone: "amber" | "green" | "neutral" | "purple" | "red";
}) {
  const toneStyles = {
    amber: "bg-amber-100 text-amber-900",
    green: "bg-emerald-100 text-emerald-900",
    neutral: "bg-neutral-200 text-neutral-800",
    purple: "bg-violet-100 text-violet-800",
    red: "bg-red-100 text-red-800",
  } as const;

  return (
    <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.05em] ${toneStyles[tone]}`}>
      {children}
    </span>
  );
}

function statusTone(status: AssetDetail["recognition"]["status"]) {
  if (status === "SUCCEEDED") return "green" as const;
  if (status === "FAILED") return "red" as const;
  return "amber" as const;
}

function statusLabel(status: AssetDetail["recognition"]["status"]) {
  return {
    FAILED: "Failed",
    INDETERMINATE: "Needs Attention",
    PROCESSING: "Analyzing",
    QUEUED: "Queued",
    SUCCEEDED: "Ready",
  }[status];
}

function editorialMatchLabel(evidenceFields: Association["evidenceFields"]) {
  const hasTitle = evidenceFields.includes("title");
  const hasCaption = evidenceFields.includes("caption");

  if (hasTitle && hasCaption) return "Pass · Title + Caption";
  if (hasTitle) return "Pass · Title";
  if (hasCaption) return "Pass · Caption";
  return "No match";
}

function identificationSourceLabel(match: Association) {
  if (match.source === "metadata-inference") return "Metadata only";
  return match.evidenceFields.length > 0 ? "AI + Metadata" : "AI only";
}

function providerLabel(provider: AssetDetail["recognition"]["provider"]) {
  return provider === "aws-rekognition" ? "AWS Rekognition" : "Fake provider";
}

function RecognitionLoadingSkeleton() {
  return (
    <div
      aria-label="Loading celebrity recognition results"
      className="mt-4 animate-pulse motion-reduce:animate-none"
      role="status"
    >
      <p className="sr-only">Celebrity recognition results are loading.</p>

      <div className="grid overflow-hidden rounded-md border border-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
        {["provider", "status", "analyzed", "threshold"].map((item) => (
          <div className="border-b border-neutral-200 p-3 sm:border-r lg:border-b-0" key={item}>
            <div className="h-2.5 w-20 rounded bg-neutral-200" />
            <div className="mt-2.5 h-4 w-28 rounded bg-neutral-300" />
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="h-5 w-40 rounded bg-neutral-300" />
        <div className="h-4 w-48 rounded bg-neutral-200" />
      </div>
      <div className="mt-2 overflow-hidden rounded-md border border-neutral-200">
        <div className="grid grid-cols-4 gap-5 bg-neutral-100 px-3 py-3">
          {["celebrity", "confidence", "metadata", "decision"].map((item) => (
            <div className="h-3 rounded bg-neutral-300" key={item} />
          ))}
        </div>
        {["face-one", "face-two"].map((item) => (
          <div className="grid grid-cols-4 gap-5 border-t border-neutral-200 px-3 py-4" key={item}>
            <div>
              <div className="h-4 w-28 rounded bg-neutral-300" />
              <div className="mt-2 h-3 w-36 rounded bg-neutral-200" />
            </div>
            <div className="h-4 w-16 rounded bg-neutral-300" />
            <div className="h-5 w-24 rounded-full bg-neutral-200" />
            <div className="h-5 w-24 rounded-full bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AiDiscoveryMetadataSection({
  asset,
  eventMetadata,
  eventMetadataError,
  hideFromSearch,
  isAddingToContent,
  isEventMetadataLoading,
  isSaving,
  onAddToContent,
  onHideFromSearchChange,
}: AiDiscoveryMetadataSectionProps) {
  const isRecognitionActive = asset.recognition.status === "QUEUED"
    || asset.recognition.status === "PROCESSING";
  const isEnrichmentPending = asset.recognition.status === "SUCCEEDED" && (
    asset.enrichment.recognitionRevision !== asset.recognition.revision
    || asset.enrichment.sourceTextRevision !== asset.sourceText.revision
  );
  const isActive = isRecognitionActive || isEnrichmentPending;
  const isFailure = asset.recognition.status === "FAILED"
    || asset.recognition.status === "INDETERMINATE";
  const associations = asset.enrichment.associations;
  const hasApprovedSearchDecision = associations.some(
    ({ searchDecision }) => searchDecision === "APPROVED",
  );

  return (
    <section
      aria-labelledby="ai-discovery-title"
      className="mt-6 rounded-md border border-neutral-200 bg-white p-5 shadow-[0_2px_5px_rgb(0_0_0/0.16)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-balance text-xl font-bold" id="ai-discovery-title">
              AI &amp; Discovery Metadata
            </h2>
            <span aria-live="polite">
              <StatusBadge tone={statusTone(asset.recognition.status)}>
                {statusLabel(asset.recognition.status)}
              </StatusBadge>
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            System-generated metadata used by celebrity and designer image search.
          </p>
        </div>
        <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-3 text-sm font-bold">
          <span>Hide from search</span>
          <input
            checked={hideFromSearch}
            className="peer sr-only"
            disabled={isSaving}
            onChange={(event) => onHideFromSearchChange(event.target.checked)}
            role="switch"
            type="checkbox"
          />
          <span className="relative h-7 w-12 rounded-full bg-neutral-400 transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[#2948b8] peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#2948b8] peer-disabled:cursor-not-allowed peer-disabled:opacity-60 motion-reduce:transition-none motion-reduce:after:transition-none" />
        </label>
      </div>

      {isFailure ? (
        <p className="mt-4 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          <strong>Recognition did not complete.</strong>{" "}
          {asset.recognition.lastError?.message ?? "The recognition result could not be established safely."}
        </p>
      ) : null}
      {isActive ? (
        <p className="mt-4 border-l-4 border-[#7c34f5] bg-violet-50 px-4 py-3 text-sm text-violet-950" role="status">
          {isRecognitionActive
            ? "The photo is available now. Celebrity recognition is running asynchronously and this section will update automatically."
            : "Celebrity recognition is complete. Approval decisions are being updated from the latest result."}
        </p>
      ) : null}
      {isActive ? <RecognitionLoadingSkeleton /> : null}

      <div className={isActive ? "hidden" : "contents"}>
        <div className="mt-4 grid gap-2 rounded-md border-l-4 border-[#7c34f5] bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-950 sm:grid-cols-3">
          <p><strong>Configured threshold or higher:</strong> automatically approved.</p>
          <p><strong>Below the threshold:</strong> approved only when title or caption confirms the name.</p>
          <p><strong>No AI match:</strong> supported metadata can create an approved association.</p>
        </div>

        <dl className="mt-4 grid overflow-hidden rounded-md border border-neutral-300 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-b border-neutral-300 p-3 sm:border-r lg:border-b-0">
            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Provider</dt>
            <dd className="mt-1 text-sm font-bold">{providerLabel(asset.recognition.provider)}</dd>
          </div>
          <div className="border-b border-neutral-300 p-3 lg:border-b-0 lg:border-r">
            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Analysis Status</dt>
            <dd className="mt-1 text-sm font-bold">{statusLabel(asset.recognition.status)}</dd>
          </div>
          <div className="border-b border-neutral-300 p-3 sm:border-b-0 sm:border-r">
            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Last Analyzed</dt>
            <dd className="mt-1 text-sm font-bold tabular-nums">{formatAnalyzedAt(asset.recognition.completedAt)}</dd>
          </div>
          <div className="p-3">
            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Auto-Approve Threshold</dt>
            <dd className="mt-1 text-sm font-bold">Server configured</dd>
          </div>
        </dl>

        <section className="mt-5" aria-labelledby="celebrity-matches-title">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3 className="text-base font-bold" id="celebrity-matches-title">
              Celebrity Matches <span className="font-normal text-neutral-500">({associations.length})</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <span>One row per celebrity association</span>
              <StatusBadge tone={hasApprovedSearchDecision && !hideFromSearch ? "green" : "amber"}>
                {hideFromSearch
                  ? "Hidden from Search"
                  : hasApprovedSearchDecision
                    ? "Search Ready"
                    : "Not Search Ready"}
              </StatusBadge>
            </div>
          </div>

          <div className="mt-2 overflow-x-auto rounded-md border border-neutral-300">
            <table className="w-full min-w-[68rem] border-collapse text-left text-sm">
              <thead className="bg-neutral-100 text-[0.65rem] uppercase tracking-[0.04em] text-neutral-600">
                <tr>
                  <th className="px-3 py-2.5" scope="col">Celebrity</th>
                  <th className="px-3 py-2.5" scope="col">Match Confidence</th>
                  <th className="px-3 py-2.5" scope="col">Identification Source</th>
                  <th className="px-3 py-2.5" scope="col">Title/Caption Check</th>
                  <th className="px-3 py-2.5" scope="col">Approval Status</th>
                  <th className="px-3 py-2.5" scope="col">Search Decision</th>
                </tr>
              </thead>
              <tbody>
                {associations.length === 0 ? (
                  <tr className="border-t border-neutral-300">
                    <td className="px-3 py-5 text-neutral-600" colSpan={6}>
                      No celebrity associations found.
                    </td>
                  </tr>
                ) : associations.map((match) => {
                  const isApproved = match.decision === "APPROVED";
                  const isSearchApproved = match.searchDecision === "APPROVED";
                  const hasEditorialEvidence = match.evidenceFields.length > 0;

                  return (
                    <tr className="border-t border-neutral-300" key={match.identityKey}>
                      <td className="px-3 py-2.5">
                        <strong className="block">{match.displayName}</strong>
                        <span className="text-xs text-neutral-500">
                          {match.providerPersonId
                            ? `Provider person ID: ${match.providerPersonId}`
                            : `Identity: ${match.identityKey}`}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-bold tabular-nums">
                        {formatMatchConfidence(match.confidence)}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge tone={match.source === "metadata-inference" ? "purple" : "neutral"}>
                          {identificationSourceLabel(match)}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge tone={hasEditorialEvidence ? "purple" : "neutral"}>
                          {editorialMatchLabel(match.evidenceFields)}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge tone={isApproved ? "green" : "amber"}>
                          {isApproved ? "Approved" : "Needs Review"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge tone={isSearchApproved && !hideFromSearch ? "green" : "amber"}>
                          {hideFromSearch
                            ? "Hidden"
                            : isSearchApproved
                              ? "Approved"
                              : "Needs Review"}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="rounded-md border border-neutral-300 p-4" aria-labelledby="event-metadata-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold" id="event-metadata-title">Event Metadata</h3>
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#2948b8] px-3 py-2 text-xs font-bold text-[#2948b8] hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2948b8] disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-500"
                disabled={isAddingToContent || isSaving}
                onClick={onAddToContent}
                type="button"
              >
                {isAddingToContent ? (
                  <span
                    aria-hidden="true"
                    className="size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-[#2948b8] motion-reduce:animate-none"
                  />
                ) : null}
                {isAddingToContent ? "Adding image…" : "Image gets added in content"}
              </button>
            </div>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-sm border border-neutral-300 p-3">
                <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Event</dt>
                <dd className="mt-1 text-sm font-bold">
                  {isEventMetadataLoading
                    ? "Loading…"
                    : eventMetadata?.id === "golden-globes"
                      ? "Golden Globe"
                      : eventMetadata?.name ?? "Not yet associated"}
                </dd>
              </div>
              <div className="rounded-sm border border-neutral-300 p-3">
                <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Event Year</dt>
                <dd className="mt-1 text-sm font-bold tabular-nums">
                  {isEventMetadataLoading ? "Loading…" : eventMetadata?.year ?? "—"}
                </dd>
              </div>
            </dl>
            {eventMetadataError ? (
              <p className="mt-3 text-xs text-red-700" role="alert">{eventMetadataError}</p>
            ) : null}
          </section>

          <section className="rounded-md border border-neutral-300 p-4" aria-labelledby="designer-associations-title">
            <h3 className="text-sm font-bold" id="designer-associations-title">Designer Associations</h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-sm border border-neutral-300 p-3">
                <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Designer</dt>
                <dd className="mt-1 text-sm font-bold">Not identified</dd>
              </div>
              <div className="rounded-sm border border-neutral-300 p-3">
                <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Evidence</dt>
                <dd className="mt-1 text-sm font-bold">—</dd>
              </div>
            </dl>
          </section>
        </div>

        <details className="mt-5 rounded-md border border-neutral-300">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2948b8]">
            <strong>Normalized Recognition Result</strong>
            <span className="text-xs text-neutral-500">Safe provider-neutral JSON</span>
            <span className="ml-auto font-bold text-[#5930c7]">View JSON ▾</span>
          </summary>
          <pre className="max-h-80 overflow-auto border-t border-neutral-300 bg-neutral-950 p-4 text-xs leading-5 text-neutral-100">
            <code>{JSON.stringify(asset.recognition.result, null, 2)}</code>
          </pre>
        </details>

        <p className="mt-4 text-xs leading-5 text-neutral-600">
          Gallery usage remains managed through “Used in places”; it is not duplicated as a single source-gallery field on the photo.
        </p>
      </div>
    </section>
  );
}
