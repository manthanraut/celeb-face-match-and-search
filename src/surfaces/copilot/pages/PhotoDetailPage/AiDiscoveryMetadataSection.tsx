import type { PhotoAsset } from "../../../../../shared/contracts/assets";

interface AiDiscoveryMetadataSectionProps {
  asset: PhotoAsset;
  rawRecognitionResponse: unknown;
}

const confidenceFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

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

function statusTone(status: PhotoAsset["recognition"]["status"]) {
  if (status === "completed") return "green" as const;
  if (status === "failed") return "red" as const;
  return "amber" as const;
}

function statusLabel(status: PhotoAsset["recognition"]["status"]) {
  return {
    completed: "Ready",
    failed: "Failed",
    processing: "Analyzing",
    queued: "Queued",
  }[status];
}

function editorialMatchLabel(
  source: PhotoAsset["celebrities"][number]["editorialTextMatch"]["source"],
) {
  if (source === "both") return "Pass · Title + Caption";
  if (source === "title") return "Pass · Title";
  if (source === "caption") return "Pass · Caption";
  return "Fail";
}

function identificationSourceLabel(
  source: PhotoAsset["celebrities"][number]["identificationSource"],
) {
  return {
    "AI image recognition only": "AI only",
    "AI image recognition only + Meta": "AI + Metadata",
    "Meta Only": "Metadata only",
  }[source];
}

function RecognitionLoadingSkeleton() {
  return (
    <div
      aria-label="Loading celebrity recognition results"
      className="mt-4 animate-pulse motion-reduce:animate-none"
      role="status"
    >
      <p className="sr-only">AWS is analyzing the image. Celebrity recognition results are loading.</p>

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
  rawRecognitionResponse,
}: AiDiscoveryMetadataSectionProps) {
  const isActive = asset.recognition.status === "queued" || asset.recognition.status === "processing";
  const isSearchReady = asset.celebrities.some(
    (celebrity) => celebrity.searchDecision === "Accepted",
  );
  const event = asset.usages[0]?.event;
  const designer = asset.designers[0];

  return (
    <section
      aria-labelledby="ai-discovery-title"
      className="mt-6 rounded-md border border-neutral-200 bg-white p-5 shadow-[0_2px_5px_rgb(0_0_0/0.16)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
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
      </div>

      {asset.recognition.status === "failed" ? (
        <p className="mt-4 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          <strong>Recognition failed.</strong> {asset.recognition.error ?? "Upload the image again after correcting the issue."}
        </p>
      ) : null}
      {isActive ? (
        <p className="mt-4 border-l-4 border-[#7c34f5] bg-violet-50 px-4 py-3 text-sm text-violet-950" role="status">
          The photo is available now. Celebrity recognition is running asynchronously and this section will update automatically.
        </p>
      ) : null}
      {isActive ? <RecognitionLoadingSkeleton /> : null}

      <div className={isActive ? "hidden" : "contents"}>
      <div className="mt-4 grid gap-2 rounded-md border-l-4 border-[#7c34f5] bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-950 sm:grid-cols-3">
        <p><strong>99% or higher:</strong> automatically approved.</p>
        <p><strong>Below 99%:</strong> approved only when title or caption confirms the name.</p>
        <p><strong>No AI match:</strong> “Celebrity in Designer” metadata can create an approved association.</p>
      </div>

      <dl className="mt-4 grid overflow-hidden rounded-md border border-neutral-300 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-b border-neutral-300 p-3 sm:border-r lg:border-b-0">
          <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Provider</dt>
          <dd className="mt-1 text-sm font-bold">AWS Rekognition</dd>
        </div>
        <div className="border-b border-neutral-300 p-3 lg:border-b-0 lg:border-r">
          <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Analysis Status</dt>
          <dd className="mt-1 text-sm font-bold capitalize">{asset.recognition.status}</dd>
        </div>
        <div className="border-b border-neutral-300 p-3 sm:border-b-0 sm:border-r">
          <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Last Analyzed</dt>
          <dd className="mt-1 text-sm font-bold tabular-nums">{formatAnalyzedAt(asset.recognition.completedAt)}</dd>
        </div>
        <div className="p-3">
          <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Auto-Approve Threshold</dt>
          <dd className="mt-1 text-sm font-bold tabular-nums">{asset.recognition.threshold}%</dd>
        </div>
      </dl>

      <section className="mt-5" aria-labelledby="celebrity-matches-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-base font-bold" id="celebrity-matches-title">
            Celebrity Matches <span className="font-normal text-neutral-500">({asset.celebrities.length})</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>One row per celebrity association</span>
            <StatusBadge tone={isSearchReady ? "green" : "amber"}>
              {isSearchReady ? "Search Ready" : "Not Search Ready"}
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
              {asset.celebrities.length === 0 ? (
                <tr className="border-t border-neutral-300">
                  <td className="px-3 py-5 text-neutral-600" colSpan={6}>
                    {isActive ? "Waiting for recognition results…" : "No celebrity associations found."}
                  </td>
                </tr>
              ) : asset.celebrities.map((match, index) => (
                <tr className="border-t border-neutral-300" key={`${match.providerPersonId ?? match.canonicalName}-${index}`}>
                  <td className="px-3 py-2.5">
                    <strong className="block">{match.canonicalName}</strong>
                    <span className="text-xs text-neutral-500">
                      {match.providerPersonId ? `AWS celebrity ID: ${match.providerPersonId}` : "No AWS celebrity ID"}
                      {match.faceNumber ? ` · Face ${match.faceNumber}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-bold tabular-nums">
                    {match.aiResponse ? `${confidenceFormatter.format(match.aiResponse.confidence)}%` : "Metadata only"}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge tone={match.identificationSource === "AI image recognition only" ? "neutral" : "purple"}>
                      {identificationSourceLabel(match.identificationSource)}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge tone={match.editorialTextMatch.matched ? "purple" : "neutral"}>
                      {editorialMatchLabel(match.editorialTextMatch.source)}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge tone={match.status === "Approved" ? "green" : "amber"}>
                      {match.status}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge tone={match.searchDecision === "Accepted" ? "green" : "amber"}>
                      {match.searchDecision}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-neutral-300 p-4" aria-labelledby="event-metadata-title">
          <h3 className="text-sm font-bold" id="event-metadata-title">Event Metadata</h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-sm border border-neutral-300 p-3">
              <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Event</dt>
              <dd className="mt-1 text-sm font-bold">{event?.eventName ?? "Not yet associated"}</dd>
            </div>
            <div className="rounded-sm border border-neutral-300 p-3">
              <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Event Year</dt>
              <dd className="mt-1 text-sm font-bold tabular-nums">{event?.year ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-md border border-neutral-300 p-4" aria-labelledby="designer-associations-title">
          <h3 className="text-sm font-bold" id="designer-associations-title">Designer Associations</h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-sm border border-neutral-300 p-3">
              <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Designer</dt>
              <dd className="mt-1 text-sm font-bold">{designer?.name ?? "Not identified"}</dd>
            </div>
            <div className="rounded-sm border border-neutral-300 p-3">
              <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Evidence</dt>
              <dd className="mt-1 text-sm font-bold">{designer?.evidence ?? "—"}</dd>
            </div>
          </dl>
        </section>
      </div>

      <details className="mt-5 rounded-md border border-neutral-300">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2948b8]">
          <strong>Raw Recognition Result</strong>
          <span className="text-xs text-neutral-500">JSON · retained locally for debugging and audit</span>
          <span className="ml-auto font-bold text-[#5930c7]">View JSON ▾</span>
        </summary>
        <pre className="max-h-80 overflow-auto border-t border-neutral-300 bg-neutral-950 p-4 text-xs leading-5 text-neutral-100">
          <code>{JSON.stringify(rawRecognitionResponse, null, 2)}</code>
        </pre>
      </details>

      <p className="mt-4 text-xs leading-5 text-neutral-600">
        Gallery usage remains managed through “Used in places”; it is not duplicated as a single source-gallery field on the photo.
      </p>
      </div>
    </section>
  );
}
