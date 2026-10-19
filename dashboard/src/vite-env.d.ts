/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface ImportMetaEnv {
  /** The bot's version, set at build time (vite.config.ts). */
  readonly VITE_APP_VERSION: string;
}
