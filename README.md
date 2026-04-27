# FlowClimb

Static Phaser game that can run directly from `index.html` and be deployed to Supabase Storage.

## Local testing

Open `index.html` directly in the browser, or serve the folder with any static server.

## Supabase Storage deploy

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-to-supabase-storage.yml`.

### Required GitHub settings

- `vars.SUPABASE_PROJECT_REF`: your Supabase project ref
- `secrets.SUPABASE_SERVICE_ROLE_KEY`: service role key for storage uploads
- `vars.SUPABASE_STORAGE_BUCKET` (optional): defaults to `flow-climber`

### What it uploads

- `index.html`
- `game.js`
- `telemetry.js`
- `spawn-worker.js`

### Public URL

After deploy, the game is available at:

`https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/index.html`

If the page shows as plain text, rerun the workflow after this MIME type fix so the existing object metadata gets overwritten.
