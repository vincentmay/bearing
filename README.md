# Bearing

Everything you follow, in one clear view: what is on, what is next, where it stands. A web app for
following esports schedules and tournaments in Counter-Strike 2, League of Legends, Rocket League,
chess and Trackmania.

What is to be built, and what has been decided, is in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).
The identity is in [docs/BRAND.md](docs/BRAND.md) and is binding.

## Run it

```sh
vp install
vp run @bearing/web#dev      # http://localhost:5810
```

With nothing else set up, the app runs entirely in the browser on a sample world: real names,
fictional events, generated results. Its live matches are played forward faster than real time,
so there is always something to follow.

## Layout

| Path                   | What it is                                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| `packages/domain`      | The canonical model, what is derived from it, the sample world, and the |
|                        | mapping of each real source into the model. No dependencies.            |
| `apps/web/src/bearing` | Every screen, the shared pieces and `bearing.css`.                      |
| `apps/web/src/lib`     | Where the world comes from, follows, accounts, settings on the device.  |
| `apps/web/convex`      | The backend: Bearing's own store, the sources that fill it, follows.    |
| `scripts`              | Browser checks that run against the dev server.                         |
| `docs`                 | Requirements, identity, data sources, and the design rounds.            |

## Checks

```sh
vp check                     # format, lint, types
vp run -r test               # domain tests
vp run -r build              # production build
node scripts/app-shots.mjs   # every screen, light and dark, phone and wide
node scripts/app-motion.mjs  # plays the sample forward and checks the live behaviour
node scripts/app-states.mjs  # waiting, could not load, nothing followed, nothing found
node scripts/app-backend.mjs # the app against its backend, while it is on the sample
node scripts/app-account.mjs # signing in and follows in the account; needs a Clerk test user
vp run -r test               # also runs the backend's own tests (apps/web/convex/*.test.ts)
```

The four scripts need the dev server. The first three keep the app on the browser's own sample,
so they give the same result whether or not a backend is configured.

In development, `window.bearing.pause()` and `window.bearing.step(n)` drive the browser's sample
by hand, and `?world=slow` or `?world=fail` on any address shows the waiting and the failed state.

## The backend (Convex) and accounts (Clerk)

Both are optional at run time. Without them the app works as above and follows are kept on the
device. The variables are described in [apps/web/.env.example](apps/web/.env.example).

1. **Convex.** In `apps/web`, run `npx convex dev`. It asks you to sign in, creates the project,
   writes `VITE_CONVEX_URL` into `.env.local` and keeps the functions in `convex/` deployed.
   Before the first push it needs the variable from step 2.
2. **Clerk.** Create an application, and in it a JWT template named `convex`. Then:
   - `npx convex env set CLERK_JWT_ISSUER_DOMAIN <the template's issuer>`
   - put the publishable key into `apps/web/.env.local` as `VITE_CLERK_PUBLISHABLE_KEY`
3. Restart the dev server. The app now reads Bearing's store, and Settings offers an account.

A new deployment holds the sample world, played forward on the server while anyone is looking, so
every open screen sees the same moment. To switch a deployment to real data and back:

```sh
npx convex run sample:useLive   # empty the store and let the real sources fill it
npx convex run sample:reset     # back to the sample
```

Real data comes from Lichess broadcasts (chess, no key) and PandaScore (Counter-Strike 2, League
of Legends, Rocket League), which needs a free token on the deployment:

```sh
npx convex env set PANDASCORE_TOKEN <token>
```

Schedules are read every hour; anything live or due every thirty seconds. What each source gives
and lacks, and what paid plans would add, is in [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md).

To deploy: `npx convex deploy` for the backend, and build the app with the production values of
the two `VITE_` variables.
