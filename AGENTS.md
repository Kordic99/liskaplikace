# Updating Liškaplikace

Every deployment must append a truthful user-facing release entry to `app/releases.json` with the next integer ID, Czech title, date and list of changes. Keep all previously published entries unchanged and in ascending order. This history powers each account's cumulative update dialog; never reset users' read markers during a deployment.

Run `node tools/check-releases.mjs`, `npm run typecheck`, `npm run test:cloud`, `npm run test:catalog` and `npm run test:releases` before publishing. CI also requires a new release entry relative to the last successfully deployed build.

Publish the app only to `Kordic99/liskaplikace`. The old `Kordic99/draci-archiv` repository contains a redirect and must not receive app source. Browser configuration keys belong in GitHub Actions variables, not tracked source files.
