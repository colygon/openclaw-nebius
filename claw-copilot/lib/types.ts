export interface DeploymentState {
  region: string | null;
  platform: string | null;
  preset: string | null;
  imageType: "openclaw" | "nemoclaw" | "custom" | null;
  customImage: string | null;
  modelId: string | null;
  provider: "token-factory" | "openrouter" | "huggingface" | null;
  endpointName: string | null;
  isPublic: boolean;
}

export interface EndpointInfo {
  id: string;
  name: string;
  state: string;
  publicIp: string | null;
  privateIp: string | null;
  platform: string | null;
  preset: string | null;
  image: string | null;
  createdAt: string | null;
}

export const INITIAL_DEPLOYMENT_STATE: DeploymentState = {
  region: null,
  platform: null,
  preset: null,
  imageType: null,
  customImage: null,
  modelId: null,
  provider: null,
  endpointName: null,
  isPublic: false,
};
