import express, { type Request as ExpressRequest, type Response as ExpressResponse, type NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { handleBackendRequest } from './src/server-core/router.ts';
import type { BackendEnv } from './src/server-core/types.ts';

dotenv.config();

// Typed Backend Environment
interface ServerEnv extends BackendEnv {
  NODE_ENV?: string;
  PORT?: string;
}

const serverEnv: ServerEnv = process.env as ServerEnv;

// Safe PORT resolution with 3000 default
const rawPort = serverEnv.PORT;
const parsedPort = rawPort ? parseInt(rawPort, 10) : 3000;
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 3000;

const app = express();

// Use raw body buffer so we can forward request body as-is to standard Request
app.use('/api', express.raw({ type: '*/*', limit: '10mb' }));

// Forward all /api/* requests to the shared backend router
app.all('/api/*', async (req: ExpressRequest, res: ExpressResponse, _next: NextFunction) => {
  const requestId = crypto.randomUUID();
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let isClientDisconnected = false;

  const onClientClose = () => {
    isClientDisconnected = true;
    if (upstreamReader) {
      upstreamReader.cancel('Client disconnected').catch(() => {});
    }
  };

  res.on('close', onClientClose);

  try {
    const protocol = req.protocol;
    const host = req.get('host') || `localhost:${PORT}`;
    const fullUrl = `${protocol}://${host}${req.originalUrl}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }
    // Track internal request ID
    headers.set('x-request-id', requestId);

    const bodyBuffer = req.body && Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body : undefined;
    const webReq = new Request(fullUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' && bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
    });

    const isDev = serverEnv.NODE_ENV !== 'production';
    const webRes = await handleBackendRequest(webReq, serverEnv, isDev ? 'local-dev' : 'render-node');

    if (isClientDisconnected || res.destroyed) {
      return;
    }

    res.status(webRes.status);
    webRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });
    res.setHeader('x-request-id', requestId);

    if (webRes.body) {
      upstreamReader = webRes.body.getReader();

      while (!isClientDisconnected && !res.destroyed) {
        const { done, value } = await upstreamReader.read();
        if (done) break;

        if (value) {
          const canContinue = res.write(Buffer.from(value));
          if (!canContinue && !res.destroyed) {
            // Respect TCP/socket backpressure: wait for drain before reading next chunk
            await new Promise<void>((resolve) => {
              const onDrain = () => {
                cleanup();
                resolve();
              };
              const onClose = () => {
                cleanup();
                resolve();
              };
              const cleanup = () => {
                res.off('drain', onDrain);
                res.off('close', onClose);
              };
              res.once('drain', onDrain);
              res.once('close', onClose);
            });
          }
        }
      }

      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    } else {
      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    }
  } catch (err: unknown) {
    const errorDetails = err instanceof Error ? err.stack || err.message : String(err);
    console.error(`[API Error] RequestID: ${requestId} -`, errorDetails);

    if (!res.headersSent && !res.destroyed) {
      res.status(500).json({
        error: 'An unexpected server error occurred',
        requestId,
      });
    } else if (!res.writableEnded && !res.destroyed) {
      res.end();
    }
  } finally {
    res.off('close', onClientClose);
  }
});

// Centralized error handling middleware
app.use((err: unknown, _req: ExpressRequest, res: ExpressResponse, _next: NextFunction) => {
  const requestId = crypto.randomUUID();
  console.error(`[Unhandled Error] RequestID: ${requestId} -`, err);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      requestId,
    });
  }
});

async function startServer() {
  if (serverEnv.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: ExpressRequest, res: ExpressResponse) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Breezy Server listening on http://0.0.0.0:${PORT} (env: ${serverEnv.NODE_ENV || 'development'})`);
  });
}

startServer().catch((err: unknown) => {
  console.error('Fatal: Server startup failed:', err);
  process.exit(1);
});
