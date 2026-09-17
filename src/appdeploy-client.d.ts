declare module '@appdeploy/client' {
  export const api: {
    get: <T = any>(path: string) => Promise<{ data: T; status: number; ok: boolean }>;
    post: <T = any>(path: string, body?: unknown) => Promise<{ data: T; status: number; ok: boolean }>;
    put: <T = any>(path: string, body?: unknown) => Promise<{ data: T; status: number; ok: boolean }>;
  };
}
