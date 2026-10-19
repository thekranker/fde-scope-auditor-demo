# fde-scope-auditor (demo mockup)

## What this is
A clickable **mockup** used at the end of customer discovery calls to show an idea and get honest reactions. It is not a real product. All data is fake and hard-coded. It is hosted on GitHub Pages.

## The idea
Forward deployed engineers (FDEs) deploy AI agents inside enterprise customers. Deployments stall because the customer's security team doesn't know what the vendor will touch, so access approval and production sign-off are slow.

FDE Scope Auditor fixes that in three steps:
1. **Before:** generate a scope of the systems, endpoints, data and permissions the deployment will need. The customer's security team approves it.
2. **During:** an independent, read-only watcher records what the FDE and the AI agent actually touch, from sources the FDE can't edit (the customer's own audit logs and API gateway logs). Records are append-only.
3. **After:** a report goes straight to the customer's security team comparing the approved scope with actual activity, flagging anything outside scope.

It also shows **how the FDE worked**: a walkthrough of the implementation (what was built, in what order, which components touch which systems, and where data flows), reconstructed from the recorded activity. Security and compliance reviewers start from that walkthrough instead of digging through code and logs, so approvals move faster.

Benefit to both sides: the buyer gets proof the vendor stayed in scope; the FDE gets proof they did nothing wrong.

Be accurate about the claim: the report shows the work **stayed within the approved scope**. It does not claim the AI agent's answers are correct. Never write copy that says "verified correct" or similar.

## Demo scenario (all fictional)
- **Vendor:** Relay AI (makes customer-support agents)
- **Customer:** Northwind Insurance
- **FDE:** Priya S.
- **Deployment:** a support agent that reads tickets in Zendesk and looks up policyholder records in Salesforce, then drafts replies
- Use only made-up company and person names. Real product names for the systems being integrated (Zendesk, Salesforce, Okta) are fine.

## The three steps
Navigation: a 3-step stepper (Approve → Watch → Report) with Back/Next buttons and ← → keys, so the presenter can click through in order during a screen share. Hashes are `#approve`, `#watch`, `#report`; the old `#scope`, `#activity` and `#build` links redirect (`#build` opens the build section in the Report).

Design rule: a first-time viewer should get the point of each screen in a few seconds, and should understand what the FDE is actually doing (setting up an AI that drafts replies to customer emails). Every screen opens with a big plain-language headline and one short subline. Rows show a plain description first (`plainLabel`); endpoints, SOQL, record sources, read/write and data-classification badges sit behind a per-row **Details** toggle. Cut anything a first-time viewer doesn't need.

### 1. Approve
- **"The job"** panel at the very top, above the headline (`copy.approve.job`): Relay is setting up an AI that drafts replies to Northwind's customer emails; to answer "Is my windshield covered?" it reads the email, looks up the customer and policy, and checks the FAQ; a Northwind employee reviews every draft; below is the access that requires
- Headline "Northwind approves exactly what Relay can touch." / "Nothing outside this list is allowed."
- Line under it: "Generated from Relay's deployment plan and integration code. Reviewed by Priya S. (Relay)." (shows the scope wasn't typed in by hand)
- Deployment card: name, vendor, customer, FDE, planned dates (no deployment ID)
- 7 requested-access rows: plain label, a one-line `why` tied to answering an email (e.g. "To see the customer's question."), and one small tag, "Can view" or "Can edit". Details holds system, endpoint/resource, read/write with note, data classification, the plan's reason and scope ID
- Status badge "Pending security review" and an **Approve scope** button. Clicking it records "Approved by M. Chen, Northwind Security" with a timestamp and moves status to "Approved"

### 2. Watch
- Headline "Every action is checked against the approved list." / "Records come from Northwind's own logs. The FDE can't edit them."
- **Start simulation** plays 8 actions, one per second; also Show all and Clear
- Each row: timestamp, plain label, actor and system, in-scope / outside-scope badge, Details (action/endpoint, record source, matching approved item)
- **Exactly one outside-scope action**, 7th of 8 (about 6 seconds in): the agent reads a Salesforce `BillingAccount` record. The simulation pauses, a red banner appears, and the row is red with the plain explanation (`flag.plain`): "On Day 5, Relay added a feature so the AI could answer 'Is my payment late?' To do that, it read the customer's billing account, which includes payment details. Northwind never approved this." The technical explanation is in Details
- Small note at the bottom: record sources, stored append-only

### 3. Report
Top to bottom:
1. Headline "1 action went outside the approved scope." / "Everything else matched what Northwind approved." (computed from the data)
2. Shared note: "Shared with Northwind Security and Relay AI. Gives Northwind proof the deployment stayed in scope, and gives Relay proof its FDE did too." with fake **Export PDF** / **Send to Northwind Security** buttons (toast only)
3. Large red "1 issue found" card: what happened (same `flag.plain` text as Watch), when, suggested next step ("Ask Relay to either get approval for billing access or remove the feature."); Details holds the technical explanation, fix options, call, record source, data class, component and record ID
4. Small stats (approved items, items used, actions recorded, outside scope), approval line, and the line saying the report does not assess whether the agent's replies are correct
5. Approved list vs. what actually happened: each scope item used / not used, plus the unapproved item flagged, with Details toggles
6. **See how it was built** (collapsed, expands in place): plain-language summary, work timeline with fake commits/config changes, components (click to see systems, permissions and linked scope rows), data flow diagram (PII, model provider, storage/retention). The `BillingAccount` call appears attached to the Salesforce lookup service and change 5a8e0f7
7. **Tamper-evident record** (collapsed): fake hash chain, purely visual

Never add time-saved, cost-saved or speed numbers.

## Global requirements
- A persistent banner on every screen: **"Mockup with fictional data. Not a live product."**
- Clean, professional, security-tool look; easy to read on a shared screen at laptop size; works on mobile too
- No login, no backend, no external API calls, no analytics, no real keys or real data
- Never include interview notes, real contact names or real customer names in this repo

## Tech
- Static site deployable to GitHub Pages from the repo root (or `/docs`): plain HTML, CSS and JavaScript, no build step required
- Keep the fake data and on-screen copy in one file (`data.js`) so the scenario is easy to edit. Only events with `feed: true` are played and reported on; the rest are kept for editing the scenario
- Repo is public; keep it that way only while it remains a mockup
