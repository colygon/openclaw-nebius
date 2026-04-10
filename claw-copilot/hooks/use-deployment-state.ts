"use client";

import { useState, useCallback } from "react";
import { useCopilotReadable } from "@copilotkit/react-core";
import {
  DeploymentState,
  EndpointInfo,
  INITIAL_DEPLOYMENT_STATE,
} from "@/lib/types";

export function useDeploymentState() {
  const [state, setState] = useState<DeploymentState>(INITIAL_DEPLOYMENT_STATE);
  const [endpoints, setEndpoints] = useState<EndpointInfo[]>([]);
  const [lastDeployPassword, setLastDeployPassword] = useState<string | null>(
    null,
  );

  useCopilotReadable({
    description:
      "Current deployment configuration being built. Null fields have not been selected yet.",
    value: state,
  });

  useCopilotReadable({
    description:
      "List of the user's Nebius AI endpoints with their current state and IPs. Empty if not yet fetched.",
    value: endpoints,
  });

  useCopilotReadable({
    description:
      "The dashboard password from the most recent deployment. Needed for getConnectionInstructions.",
    value: lastDeployPassword,
  });

  const updateState = useCallback((patch: Partial<DeploymentState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetState = useCallback(() => {
    setState(INITIAL_DEPLOYMENT_STATE);
    setLastDeployPassword(null);
  }, []);

  return {
    state,
    endpoints,
    lastDeployPassword,
    updateState,
    resetState,
    setEndpoints,
    setLastDeployPassword,
  };
}
