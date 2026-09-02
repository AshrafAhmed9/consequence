export { ApplicationDurableObject } from "./application-do.js";

export interface Env {
  APPLICATION: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/application/")) {
      const appId = url.pathname.split("/")[3] ?? "demo";
      const id = env.APPLICATION.idFromName(appId);
      const stub = env.APPLICATION.get(id);
      return stub.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
