# FDE Scope Auditor (mockup)

**Mockup with fictional data. Not a live product.**

A clickable demo for discovery calls. It shows three steps for an AI-agent deployment: Approve → Watch → Report. All names and data are made up.

## Run locally
Open `index.html` in a browser. There is no build step and no backend.

## Deploy
GitHub Pages → Settings → Pages → deploy from branch, root folder.

## Edit the scenario
All data is in `data.js`. `app.js` renders it and `styles.css` styles it.

## Presenting
- Use ← / → keys or the Back / Next buttons to move between steps.
- Step 1: click **Approve scope**.
- Step 2: click **Start simulation**. It pauses on the outside-scope action after about 6 seconds. Click Resume, or **Show all**.
- Step 3: the issue card is at the top. **See how it was built** and **Tamper-evident record** expand in place.
- Any row's **Details** button shows the endpoint, query and record source.
- **Reset demo** (top right) puts everything back to the start.
