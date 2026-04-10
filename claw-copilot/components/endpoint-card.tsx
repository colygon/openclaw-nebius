"use client";

import type { EndpointInfo } from "@/lib/types";

const STATE_COLORS: Record<string, string> = {
  RUNNING: "bg-green-500",
  STARTING: "bg-yellow-500",
  CREATING: "bg-yellow-500",
  STOPPED: "bg-gray-500",
  STOPPING: "bg-orange-500",
  FAILED: "bg-red-500",
  DELETING: "bg-red-400",
};

export function EndpointCard({ endpoint }: { endpoint: EndpointInfo }) {
  const dotColor = STATE_COLORS[endpoint.state] ?? "bg-gray-400";
  const ip = endpoint.publicIp ?? endpoint.privateIp ?? "no IP";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{endpoint.name || endpoint.id}</span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
          {endpoint.state}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
        <span>{ip}</span>
        {endpoint.platform && <span>{endpoint.platform}</span>}
        {endpoint.preset && <span>{endpoint.preset}</span>}
      </div>
    </div>
  );
}
