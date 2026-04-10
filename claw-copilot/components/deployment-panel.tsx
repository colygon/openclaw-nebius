"use client";

import type { DeploymentState, EndpointInfo } from "@/lib/types";
import { EndpointCard } from "./endpoint-card";

interface DeploymentPanelProps {
  state: DeploymentState;
  endpoints: EndpointInfo[];
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

export function DeploymentPanel({ state, endpoints }: DeploymentPanelProps) {
  const hasAnySelection = Object.values(state).some(
    (v) => v !== null && v !== false,
  );

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--background)]">
      <div className="border-b border-[var(--border)] p-4">
        <h2 className="text-lg font-semibold">Claw Copilot</h2>
        <p className="text-xs text-gray-400">OpenClaw Deployment Assistant</p>
      </div>

      {hasAnySelection && (
        <div className="border-b border-[var(--border)] p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Current Config
          </h3>
          <div className="space-y-1">
            <Field label="Region" value={state.region} />
            <Field label="Platform" value={state.platform} />
            <Field label="Preset" value={state.preset} />
            <Field label="Image" value={state.imageType} />
            <Field label="Model" value={state.modelId} />
            <Field label="Provider" value={state.provider} />
            <Field label="Name" value={state.endpointName} />
            <Field
              label="Network"
              value={
                state.isPublic ? "Public" : state.region ? "Private" : null
              }
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Endpoints {endpoints.length > 0 && `(${endpoints.length})`}
        </h3>
        {endpoints.length === 0 ? (
          <p className="text-xs text-gray-500">
            No endpoints loaded yet. Ask the assistant to list your endpoints.
          </p>
        ) : (
          <div className="space-y-2">
            {endpoints.map((ep) => (
              <EndpointCard key={ep.id} endpoint={ep} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
