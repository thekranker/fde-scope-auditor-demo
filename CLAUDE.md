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

## The four screens
Navigation: a simple 4-step stepper or tabs (Scope → Live activity → How it was built → Report) so the presenter can click through in order during a screen share.

### 1. Scope
- Header: deployment name, vendor, customer, FDE, planned dates
- Table of requested access, about 6 rows: system, endpoint or resource, access type (read/write), data classification (e.g. PII), reason
  - Examples: Zendesk tickets (read), Zendesk ticket comments (write, draft replies only), Salesforce Contact (read), Salesforce Policy__c (read), Okta SSO app assignment, an internal FAQ knowledge base (read)
- Status badge "Pending security review" and an **Approve scope** button. Clicking it records the approver (e.g. "Approved by M. Chen, Northwind Security") with a timestamp and moves status to "Approved".

### 2. Live activity
- A feed of events that plays in when the presenter clicks **Start simulation** (events appear every ~1 second; also a "Show all" option)
- Each event: timestamp, actor (FDE Priya S. or "Relay support agent"), system, action/endpoint, source of the record (e.g. "Salesforce Event Monitoring", "Zendesk audit log", "API gateway"), and an in-scope / out-of-scope badge
- About 15 to 20 events, mostly in scope
- **Exactly one out-of-scope event** partway through, the moment the demo is built around: e.g. the agent calls a Salesforce `BillingAccount` endpoint that was never in the approved scope. It should stand out clearly (red badge, short explanation)
- Small note on the screen: records are read from the customer's own logs and stored append-only; the FDE cannot edit them

### 3. How it was built (implementation walkthrough)
The screen a security reviewer starts from. It explains the FDE's work in plain language, reconstructed from the recorded activity.
- **Work timeline:** the FDE's phases in order, e.g. Day 1 SSO setup in Okta, Days 2-3 Zendesk integration, Day 4 Salesforce policy lookup, Day 5 agent workflow and prompt configuration, Day 6 testing on sample tickets. Each phase lists its key steps and a few fake commit or config-change summaries
- **Components:** the pieces that were built (e.g. Zendesk connector, Salesforce lookup service, reply-drafting agent). Clicking a component shows which systems, endpoints and permissions it uses, linked back to the matching scope rows
- **Data flow diagram:** Zendesk ticket → Relay agent → Salesforce read (policy lookup) → draft reply → Zendesk comment. Mark where PII moves, what is stored, retention, and that ticket text is sent to the vendor's model provider
- **Plain-language summary** at the top, 3-4 sentences a compliance reviewer can read in 30 seconds
- The out-of-scope `BillingAccount` call should appear here too, attached to the component that made it, so the reviewer sees where in the build it came from

### 4. Report
- Summary at top: approved items vs. items actually used, number of events, number of out-of-scope events
- Comparison table: each approved scope item with used / not used, plus the unapproved item flagged
- Flag detail for the out-of-scope event: what happened, when, which actor, where the record came from, suggested next step ("Ask vendor to justify or remove")
- A "Tamper-evident record" panel showing a fake hash chain or record ID to illustrate that the log is append-only (purely visual)
- A fake **Export PDF** / **Send to Northwind Security** button (can just show a toast)

## Global requirements
- A persistent banner on every screen: **"Mockup with fictional data. Not a live product."**
- Clean, professional, security-tool look; easy to read on a shared screen at laptop size; works on mobile too
- No login, no backend, no external API calls, no analytics, no real keys or real data
- Never include interview notes, real contact names or real customer names in this repo

## Tech
- Static site deployable to GitHub Pages from the repo root (or `/docs`): plain HTML, CSS and JavaScript, no build step required
- Keep the fake data in one file (e.g. `data.js`) so the scenario is easy to edit
- Repo is public; keep it that way only while it remains a mockup
