# FlowClimb

Static Phaser game that can run directly from `index.html` and be deployed to GitHub Pages.

## Local testing

Open `index.html` directly in the browser, or serve the folder with any static server.

## GitHub Pages deploy

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-to-github-pages.yml`.

### Required GitHub settings

- Enable GitHub Pages for the repository
- Set the source to `GitHub Actions`

### What it deploys

- `index.html`
- `game.js`
- `telemetry.js`
- `spawn-worker.js`

### Public URL

After deploy, the game is available at your Pages URL, for example:

`https://<user>.github.io/<repo>/`
