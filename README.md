# FlowClimb

Static Phaser game that can be served from any static HTTP server and deployed to GitHub Pages.

## Local testing

Serve the folder with the built-in local dev command, then open the local HTTP URL. Direct `file://` loading is no longer supported because browsers block ONNX model fetches from local files.

```bash
npm start
```

Then open:

`http://localhost:8000/`

Equivalent manual command:

```bash
python3 -m http.server 8000
```

## Machine learning

Training scaffolding lives in `ml/`. It uses a Conda environment, MLflow tracking, CSV exports in `ml/data/`, and ONNX model outputs in `ml/models/`. Promoted game-ready ONNX artifacts live in `src/models/flow/` as stable `active.*` aliases.

See `ml/README.md`.

## GitHub Pages deploy

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-to-github-pages.yml`.

### Required GitHub settings

- Enable GitHub Pages for the repository
- Set the source to `GitHub Actions`

### What it deploys

- `index.html`
- `src/game.js`
- `src/telemetry.js`
- `src/spawn-worker.js`
- supporting scripts in `src/`

### Public URL

After deploy, the game is available at your Pages URL, for example:

`https://<user>.github.io/<repo>/`
