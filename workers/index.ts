/**
 * Cloudflare Worker Backend Entrypoint for Breezy Research
 * Primary Backend Engine (Edge V8 Isolate)
 */

import { handleBackendRequest } from '../src/server-core/router';
import { BackendEnv } from '../src/server-core/types';

export default {
  async fetch(request: Request, env: BackendEnv, ctx: any): Promise<Response> {
    return handleBackendRequest(request, env, 'cloudflare-worker');
  },
};
