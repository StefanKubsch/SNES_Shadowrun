import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TRIBUTE_TRACKS, TRIBUTE_MAIN_THEME } from '../src/browser/tribute-tracks.mjs';

const HTTP_OK = 200,
  HTTP_PARTIAL = 206,
  HTTP_RANGE_INVALID = 416,
  HTTP_NOT_FOUND = 404,
  PORT = 8080;
const TRIBUTE_PATHS = new Set(
  [...Object.values(TRIBUTE_TRACKS), TRIBUTE_MAIN_THEME].map(
    (track) => '/assets/tribute/' + track.file,
  ),
);
// Files the game page may load: the page, overlay styles, its two images, modules and data
// package (docs/ROM-FREE.md, no ROM; samples as WAV in vm-samples/). tools/build-web.mjs
// copies exactly these files for a static host.
export const isServedPath = (path) =>
  !path.includes('..') &&
  (path === '/' ||
    path === '/index.html' ||
    path === '/src/browser/overlays.css' ||
    path === '/src/browser/pvm-20m2e-bezel.png' ||
    path === '/src/browser/shadowrun-logo.png' ||
    TRIBUTE_PATHS.has(path) ||
    /^\/src\/[a-z0-9/-]+\.mjs$/i.test(path) ||
    /^\/assets\/(vm-[a-z0-9-]+\.(json|bin|bmp)|scripts\.json|vm-samples\/[0-9A-F]{6}\.wav)$/.test(
      path,
    ));
// Cross-origin isolation (COOP/COEP) allows SharedArrayBuffer: the worker reads the pad
// word and waits for the display through shared memory.
export const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};
export function browserServer(root = process.cwd()) {
  return http.createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!isServedPath(path)) {
      res.writeHead(HTTP_NOT_FOUND).end();
      return;
    }
    try {
      const data = await readFile(resolve(root, '.' + (path === '/' ? '/index.html' : path)));
      const headers = {
        'Content-Type':
          {
            '.html': 'text/html; charset=utf-8',
            '.mjs': 'text/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json',
            '.bin': 'application/octet-stream',
            '.bmp': 'image/bmp',
            '.png': 'image/png',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
          }[extname(path === '/' ? '.html' : path)] ?? 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        ...ISOLATION_HEADERS,
      };
      // Media elements seek and loop through byte ranges, including on a static host.
      if (TRIBUTE_PATHS.has(path)) {
        headers['Accept-Ranges'] = 'bytes';
        const range = req.headers.range;
        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range);
          let start = match?.[1] ? Number(match[1]) : 0,
            end = match?.[2] ? Number(match[2]) : data.length - 1;
          if (match && !match[1] && match[2]) {
            start = Math.max(0, data.length - Number(match[2]));
            end = data.length - 1;
          }
          if (
            !match ||
            (!match[1] && !match[2]) ||
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start > end ||
            start >= data.length
          ) {
            res
              .writeHead(HTTP_RANGE_INVALID, {
                ...headers,
                'Content-Range': `bytes */${data.length}`,
              })
              .end();
            return;
          }
          end = Math.min(end, data.length - 1);
          res.writeHead(HTTP_PARTIAL, {
            ...headers,
            'Content-Range': `bytes ${start}-${end}/${data.length}`,
            'Content-Length': end - start + 1,
          });
          res.end(data.subarray(start, end + 1));
          return;
        }
      }
      res.writeHead(HTTP_OK, { ...headers, 'Content-Length': data.length });
      res.end(data);
    } catch {
      res.writeHead(HTTP_NOT_FOUND).end();
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = browserServer();
  server.listen(PORT, '127.0.0.1', () => console.log(`Shadowrun: http://127.0.0.1:${PORT}`));
}
