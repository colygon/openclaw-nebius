"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { DeploymentPanel } from "./deployment-panel";
import { useDeploymentState } from "@/hooks/use-deployment-state";

export function CopilotProvider() {
  const {
    state,
    endpoints,
  } = useDeploymentState();

  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <div className="flex h-screen">
        <DeploymentPanel state={state} endpoints={endpoints} />
        <div className="flex flex-1 flex-col">
          <CopilotChat
            className="flex-1"
            labels={{
              title: "Deploy Assistant",
              initial:
                "Hi! I can help you deploy OpenClaw agents to Nebius Cloud. Want me to check if your nebius CLI is set up, or would you like to deploy an agent right away?",
            }}
          />
        </div>
      </div>
    </CopilotKit>
  );
}
