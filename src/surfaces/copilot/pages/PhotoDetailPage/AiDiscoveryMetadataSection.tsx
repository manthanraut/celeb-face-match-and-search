import { useState } from "react";

import type { RecognitionResult } from "../../../../../shared/contracts/recognition";

interface AiDiscoveryMetadataSectionProps {
  assetId: string;
}

const celebrityMatches = [
  {
    captionCheck: "Confirmed",
    confidence: 98.4,
    faceNumber: 1,
    name: "Rihanna",
    providerPersonId: "3R4EXAMPLE",
    recognitionStatus: "recognized",
    searchDecision: "Accepted",
  },
  {
    captionCheck: "Not Found",
    confidence: 91.2,
    faceNumber: 2,
    name: "A$AP Rocky",
    providerPersonId: "7K2EXAMPLE",
    recognitionStatus: "uncertain",
    searchDecision: "Needs Review",
  },
] as const;

const demoRecognitionResult = {
  schemaVersion: "1.0",
  provider: "aws-rekognition",
  model: "Celebrity Recognition v1 (demo)",
  faces: celebrityMatches.map((match, index) => ({
    candidateName: match.name,
    providerPersonId: match.providerPersonId,
    confidence: match.confidence,
    confidenceKind: "provider-score" as const,
    recognitionStatus: match.recognitionStatus,
    boundingBox:
      index === 0
        ? { left: 0.18, top: 0.12, width: 0.24, height: 0.46 }
        : { left: 0.58, top: 0.16, width: 0.21, height: 0.42 },
  })),
  unrecognizedFaceCount: 0,
  warnings: ["One match requires a caption check before becoming searchable."],
} satisfies RecognitionResult;

const confidenceFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const analyzedAt = new Date("2026-08-15T11:48:00+05:30");
const analyzedDate = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
  year: "numeric",
}).format(analyzedAt);
const analyzedTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
}).format(analyzedAt);

function StatusBadge({ children, tone }: { children: string; tone: "amber" | "green" | "purple" }) {
  const toneStyles = {
    amber: "bg-amber-100 text-amber-900",
    green: "bg-emerald-100 text-emerald-900",
    purple: "bg-violet-100 text-violet-800",
  } as const;

  return (
    <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.05em] ${toneStyles[tone]}`}>
      {children}
    </span>
  );
}

export function AiDiscoveryMetadataSection({ assetId }: AiDiscoveryMetadataSectionProps) {
  const [isRerunQueued, setIsRerunQueued] = useState(false);

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
              <StatusBadge tone={isRerunQueued ? "amber" : "green"}>
                {isRerunQueued ? "Queued" : "Ready"}
              </StatusBadge>
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            System-generated metadata used by celebrity and designer image search.
          </p>
        </div>
        <button
          className="min-h-11 rounded-md bg-[#7c34f5] px-5 py-2 text-sm font-bold text-white hover:bg-[#6422d9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c34f5] disabled:cursor-not-allowed disabled:bg-neutral-400"
          disabled={isRerunQueued}
          onClick={() => setIsRerunQueued(true)}
          type="button"
        >
          {isRerunQueued ? "Recognition Queued" : "Run Recognition Again"}
        </button>
      </div>

      <p className="mt-4 border-l-4 border-[#7c34f5] bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-950">
        <strong>Illustrative mock data.</strong> Celebrity suggestions require confidence and caption checks before becoming searchable.
      </p>

      <dl className="mt-4 grid overflow-hidden rounded-md border border-neutral-300 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-b border-neutral-300 p-3 sm:border-r lg:border-b-0">
          <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Provider</dt>
          <dd className="mt-1 text-sm font-bold">AWS Rekognition</dd>
        </div>
        <div className="border-b border-neutral-300 p-3 lg:border-b-0 lg:border-r">
          <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Analysis Status</dt>
          <dd className="mt-1 text-sm font-bold">{isRerunQueued ? "Queued" : "Completed"}</dd>
        </div>
        <div className="border-b border-neutral-300 p-3 sm:border-b-0 sm:border-r">
          <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Last Analyzed</dt>
          <dd className="mt-1 text-sm font-bold tabular-nums">
            {analyzedDate} · {analyzedTime}
          </dd>
        </div>
        <div className="p-3">
          <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Threshold</dt>
          <dd className="mt-1 text-sm font-bold tabular-nums">85%</dd>
        </div>
      </dl>

      <section className="mt-5" aria-labelledby="celebrity-matches-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-base font-bold" id="celebrity-matches-title">
            Celebrity Matches <span className="font-normal text-neutral-500">({celebrityMatches.length})</span>
          </h3>
          <p className="text-xs text-neutral-500">One row per face detected in the image</p>
        </div>

        <div className="mt-2 overflow-x-auto rounded-md border border-neutral-300">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <thead className="bg-neutral-100 text-[0.65rem] uppercase tracking-[0.04em] text-neutral-600">
              <tr>
                <th className="px-3 py-2.5" scope="col">Celebrity</th>
                <th className="px-3 py-2.5" scope="col">Match Confidence</th>
                <th className="px-3 py-2.5" scope="col">Caption Check</th>
                <th className="px-3 py-2.5" scope="col">Search Decision</th>
              </tr>
            </thead>
            <tbody>
              {celebrityMatches.map((match) => (
                <tr className="border-t border-neutral-300" key={match.providerPersonId}>
                  <td className="px-3 py-2.5">
                    <strong className="block">{match.name}</strong>
                    <span className="text-xs text-neutral-500">
                      AWS celebrity ID: {match.providerPersonId} · Face {match.faceNumber}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-bold tabular-nums">
                    {confidenceFormatter.format(match.confidence)}%
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge tone={match.captionCheck === "Confirmed" ? "purple" : "amber"}>
                      {match.captionCheck}
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
              <dd className="mt-1 text-sm font-bold">Met Gala</dd>
            </div>
            <div className="rounded-sm border border-neutral-300 p-3">
              <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Event Year</dt>
              <dd className="mt-1 text-sm font-bold tabular-nums">2027</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-md border border-neutral-300 p-4" aria-labelledby="designer-associations-title">
          <h3 className="text-sm font-bold" id="designer-associations-title">Designer Associations</h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-sm border border-neutral-300 p-3">
              <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Designer</dt>
              <dd className="mt-1 text-sm font-bold">Marc Jacobs</dd>
            </div>
            <div className="rounded-sm border border-neutral-300 p-3">
              <dt className="text-[0.65rem] font-bold uppercase tracking-[0.04em] text-neutral-500">Evidence</dt>
              <dd className="mt-1 text-sm font-bold">Global Caption · Rihanna</dd>
            </div>
          </dl>
        </section>
      </div>

      <details className="mt-5 rounded-md border border-neutral-300">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2948b8]">
          <strong>Raw Recognition Result</strong>
          <span className="text-xs text-neutral-500">JSON · retained for debugging and audit</span>
          <span className="ml-auto font-bold text-[#5930c7]">View JSON ▾</span>
        </summary>
        <pre className="max-h-80 overflow-auto border-t border-neutral-300 bg-neutral-950 p-4 text-xs leading-5 text-neutral-100">
          <code>{JSON.stringify({ assetId, ...demoRecognitionResult }, null, 2)}</code>
        </pre>
      </details>

      <p className="mt-4 text-xs leading-5 text-neutral-600">
        Gallery usage remains managed through “Used in places”; it is not duplicated as a single source-gallery field on the photo.
      </p>
    </section>
  );
}
