# Private static hosting

The game page needs no server code; any static host can serve it. This
working directory can also hold ignored local ROMs and contains the Nintendo manuals, so never
publish the repository root. `npm run build:web` ([build-web.mjs](../tools/build-web.mjs))
copies only the files that the local server serves into `dist/`: the page, its
images, source modules, the shared [overlay stylesheet](../src/browser/overlays.css),
the data package (no ROM) and the twelve OGG files
of the [alternative soundtrack](TRIBUTE-SOUNDTRACK.md). It also writes
`dist/_headers` with the cross-origin isolation headers (COOP/COEP) that the
page needs for `SharedArrayBuffer`; without them the game runs with delayed
input and says so.

The game data stays copyrighted material of the original game. Keep any
hosted copy private: on Cloudflare, protect it with Cloudflare Access
(Zero Trust) and a policy that admits only your own account, and check that
the `workers.dev` address and preview addresses are covered too. An address
that is merely unlisted is still public.

## Cloudflare Workers

[wrangler.jsonc](../wrangler.jsonc) deploys `dist/` as static assets; its
`name` must equal the Worker's name in the dashboard.

- Build from Git: build command `npm run build:web`, deploy command
  `npx wrangler deploy`, root directory `/`. The data package lies in Git
  LFS; if the build host does not fetch LFS files, the build stops with
  "is a Git LFS pointer" instead of deploying a broken game.
- Deploy from this computer instead (no LFS question): `npm run build:web`,
  then `npx wrangler deploy`.
