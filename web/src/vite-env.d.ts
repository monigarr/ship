/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: 'development' | 'test_e2e' | 'production';
  readonly VITE_API_URL: string;
  readonly VITE_LANGSMITH_TRACES_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
