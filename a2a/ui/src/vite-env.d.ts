/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SCENARIO?: string;
  readonly VITE_HUB_URL?: string;
  readonly VITE_EXPLORER?: string;
  readonly VITE_AGENT_A_ADDRESS?: string;
  readonly VITE_AGENT_B_ADDRESS?: string;
  readonly VITE_ESCROW_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
