import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import OpenAI from "openai";
import { getSystemPrompt } from "@/lib/system-prompt";
import { actions } from "@/lib/actions";

const openai = new OpenAI({
  apiKey: process.env.TOKEN_FACTORY_API_KEY ?? "",
  baseURL:
    process.env.TOKEN_FACTORY_URL ??
    "https://api.tokenfactory.nebius.com/v1",
});

const serviceAdapter = new OpenAIAdapter({
  openai,
  model: process.env.NEBIUS_MODEL ?? "deepseek-ai/DeepSeek-V3.2",
});

const runtime = new CopilotRuntime({
  actions,
});

export const POST = async (req: Request) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
