/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_AMAP_KEY: string;
  readonly VITE_AMAP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
