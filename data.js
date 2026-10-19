// All demo data lives here. Everything is fictional.
// Edit this file to change the scenario; app.js only renders it.

window.DEMO = {
  deployment: {
    name: "Northwind Support Agent Pilot",
    id: "DEP-2026-0417",
    vendor: "Relay AI",
    vendorShort: "Relay",
    customer: "Northwind Insurance",
    customerShort: "Northwind",
    fde: "Priya S.",
    fdeRole: "Forward Deployed Engineer, Relay AI",
    plannedStart: "Mon 5 Oct 2026",
    plannedEnd: "Sat 10 Oct 2026",
    summary:
      "A support agent that reads tickets in Zendesk, looks up policyholder records in Salesforce, and drafts replies as internal notes for a Northwind agent to review and send.",
  },

  // On-screen copy: one headline and one subline per step.
  copy: {
    approve: {
      headline: "Northwind approves exactly what Relay can touch.",
      subline: "Nothing outside this list is allowed.",
      generated: "Generated from Relay's deployment plan and integration code. Reviewed by Priya S. (Relay).",
    },
    watch: {
      headline: "Every action is checked against the approved list.",
      subline: "Records come from Northwind's own logs. The FDE can't edit them.",
      sources: "Sources: Okta System Log, Zendesk audit log, Salesforce Event Monitoring and Northwind's API gateway. Records are stored append-only.",
    },
    report: {
      subline: "Everything else matched what Northwind approved.",
      sublineClean: "Everything matched what Northwind approved.",
      shared: "Shared with Northwind Security and Relay AI. Gives Northwind proof the deployment stayed in scope, and gives Relay proof its FDE did too.",
      disclaimer: "This report shows whether recorded activity stayed within the approved scope. It does not assess whether the agent's replies are correct.",
    },
  },

  approval: {
    approver: "M. Chen",
    team: "Northwind Security",
    timestamp: "Fri 2 Oct 2026, 14:32 ET",
  },

  // Requested access. `id` is used to link events and components back to scope rows.
  scope: [
    {
      id: "S1",
      plainLabel: "Set up Northwind sign-in (SSO) for the agent",
      system: "Okta",
      resource: "SSO app \"Relay Support Agent\": create app, assign pilot group",
      access: "write",
      accessNote: "app config only",
      classification: "Internal",
      reason: "Let pilot support staff sign in to the agent console with Northwind SSO.",
    },
    {
      id: "S2",
      plainLabel: "Read support tickets",
      system: "Zendesk",
      resource: "Tickets: GET /api/v2/tickets, /tickets/{id}, /tickets/{id}/comments",
      access: "read",
      classification: "PII",
      reason: "Read the customer's question and ticket history to draft a reply.",
    },
    {
      id: "S3",
      plainLabel: "Save draft replies as private notes",
      system: "Zendesk",
      resource: "Ticket comments: PUT /api/v2/tickets/{id} (public: false)",
      access: "write",
      accessNote: "draft internal notes only",
      classification: "PII",
      reason: "Post the drafted reply as a private note. A Northwind agent decides whether to send it.",
    },
    {
      id: "S4",
      plainLabel: "Look up policyholder contact info",
      system: "Salesforce",
      resource: "Contact object: Name, Email, Phone",
      access: "read",
      classification: "PII",
      reason: "Match the ticket requester to a policyholder record.",
    },
    {
      id: "S5",
      plainLabel: "Look up policy status and coverage",
      system: "Salesforce",
      resource: "Policy__c object: Policy_Number__c, Status__c, Coverage_Type__c, Renewal_Date__c",
      access: "read",
      classification: "PII / Confidential",
      reason: "Look up policy status and coverage to answer policy questions.",
    },
    {
      id: "S6",
      plainLabel: "Read the claims FAQ",
      system: "Northwind Help Center KB",
      resource: "Articles in space \"claims-faq\" (search + read)",
      access: "read",
      classification: "Internal",
      reason: "Ground draft replies in Northwind's approved FAQ wording.",
    },
    {
      id: "S7",
      plainLabel: "Check open claims cases (optional)",
      system: "Salesforce",
      resource: "Case object: Subject, Status",
      access: "read",
      classification: "Confidential",
      reason: "Check for open claims cases linked to the policyholder (optional).",
    },
  ],

  // Activity recorded by the independent watcher.
  // scopeId: null means the action matched no approved scope row.
  // feed: true marks the 8 events the demo plays and reports on; the rest are kept for editing the scenario.
  events: [
    { feed: true, plainLabel: "Set up Northwind sign-in for the agent", ts: "Mon 5 Oct, 09:12", actor: "fde", system: "Okta", action: "Created SAML app integration \"Relay Support Agent\"", source: "Okta System Log", scopeId: "S1", component: "C1" },
    { plainLabel: "Give the 12-person pilot group access", ts: "Mon 5 Oct, 09:40", actor: "fde", system: "Okta", action: "Assigned group \"Support-Pilot\" (12 users) to app", source: "Okta System Log", scopeId: "S1", component: "C1" },
    { plainLabel: "List open support tickets", ts: "Tue 6 Oct, 10:05", actor: "fde", system: "Zendesk", action: "GET /api/v2/tickets?status=open (25 results)", source: "Northwind API gateway", scopeId: "S2", component: "C2" },
    { feed: true, plainLabel: "Read a support ticket", ts: "Tue 6 Oct, 10:22", actor: "agent", system: "Zendesk", action: "GET /api/v2/tickets/48213", source: "Northwind API gateway", scopeId: "S2", component: "C2" },
    { feed: true, plainLabel: "Save a draft reply as a private note", ts: "Tue 6 Oct, 14:10", actor: "agent", system: "Zendesk", action: "PUT /api/v2/tickets/48213, comment public: false", source: "Zendesk audit log", scopeId: "S3", component: "C2" },
    { plainLabel: "Read a ticket's comment history", ts: "Wed 7 Oct, 11:30", actor: "fde", system: "Zendesk", action: "GET /api/v2/tickets/48219/comments", source: "Northwind API gateway", scopeId: "S2", component: "C2" },
    { plainLabel: "Save a draft reply as a private note", ts: "Wed 7 Oct, 15:02", actor: "agent", system: "Zendesk", action: "PUT /api/v2/tickets/48219, comment public: false", source: "Zendesk audit log", scopeId: "S3", component: "C2" },
    { plainLabel: "Check which contact fields exist", ts: "Thu 8 Oct, 09:15", actor: "fde", system: "Salesforce", action: "GET /sobjects/Contact/describe", source: "Salesforce Event Monitoring", scopeId: "S4", component: "C3" },
    { feed: true, plainLabel: "Look up policyholder contact info", ts: "Thu 8 Oct, 09:48", actor: "agent", system: "Salesforce", action: "SOQL: SELECT Name, Email FROM Contact WHERE Email = :requester", source: "Salesforce Event Monitoring", scopeId: "S4", component: "C3" },
    { feed: true, plainLabel: "Look up policy status", ts: "Thu 8 Oct, 10:20", actor: "agent", system: "Salesforce", action: "SOQL: SELECT Policy_Number__c, Status__c FROM Policy__c WHERE Contact__c = :id", source: "Salesforce Event Monitoring", scopeId: "S5", component: "C3" },
    { plainLabel: "List claims FAQ articles", ts: "Fri 9 Oct, 10:00", actor: "fde", system: "Northwind Help Center KB", action: "GET /kb/articles?space=claims-faq", source: "Northwind API gateway", scopeId: "S6", component: "C4" },
    { feed: true, plainLabel: "Search the claims FAQ", ts: "Fri 9 Oct, 11:15", actor: "agent", system: "Northwind Help Center KB", action: "Search \"windshield claim deductible\"", source: "Northwind API gateway", scopeId: "S6", component: "C4" },
    {
      feed: true,
      plainLabel: "Read a billing account",
      ts: "Fri 9 Oct, 13:07",
      actor: "agent",
      system: "Salesforce",
      action: "GET /sobjects/BillingAccount/0BA5e000003xQ2R",
      source: "Salesforce Event Monitoring",
      scopeId: null,
      component: "C3",
      flag: {
        title: "Salesforce BillingAccount read, not in approved scope",
        short: "Billing accounts hold payment details. Northwind never approved access to them.",
        explanation:
          "The agent read a BillingAccount record (payment method, balance due). No approved scope row covers BillingAccount. The call came from the Salesforce lookup service after a \"payment status fallback\" change on Day 5.",
        dataClass: "Financial / Confidential",
        nextStep: "Ask vendor to justify or remove",
        nextDetail: "Relay AI either adds BillingAccount to the scope for Northwind to approve, or removes the call (change 5a8e0f7).",
      },
    },
    { plainLabel: "Look up policy coverage and renewal date", ts: "Fri 9 Oct, 16:40", actor: "agent", system: "Salesforce", action: "SOQL: SELECT Coverage_Type__c, Renewal_Date__c FROM Policy__c WHERE Id = :policy", source: "Salesforce Event Monitoring", scopeId: "S5", component: "C3" },
    { plainLabel: "Read a sample ticket", ts: "Sat 10 Oct, 09:30", actor: "agent", system: "Zendesk", action: "GET /api/v2/tickets/48240 (sample ticket)", source: "Northwind API gateway", scopeId: "S2", component: "C2" },
    { plainLabel: "Look up policyholder contact info", ts: "Sat 10 Oct, 09:31", actor: "agent", system: "Salesforce", action: "SOQL: SELECT Name, Email FROM Contact WHERE Email = :requester", source: "Salesforce Event Monitoring", scopeId: "S4", component: "C3" },
    { plainLabel: "Save a draft reply as a private note", ts: "Sat 10 Oct, 09:32", actor: "agent", system: "Zendesk", action: "PUT /api/v2/tickets/48240, comment public: false", source: "Zendesk audit log", scopeId: "S3", component: "C2" },
    { feed: true, plainLabel: "Remove the FDE's test login", ts: "Sat 10 Oct, 15:50", actor: "fde", system: "Okta", action: "Removed FDE test user from app assignment", source: "Okta System Log", scopeId: "S1", component: "C1" },
  ],

  actors: {
    fde: "FDE Priya S.",
    agent: "Relay support agent",
  },

  // How it was built.
  buildSummary: [
    "Over six days, Priya S. set up Northwind SSO for a new support agent, connected it to Zendesk to read tickets and post draft replies as private notes, and connected it to Salesforce to look up policyholder and policy records.",
    "Draft replies are grounded in Northwind's claims FAQ and are never sent to customers automatically. A Northwind support agent reviews every draft.",
    "Ticket text and policy details pass through Relay's model provider to generate drafts. Relay stores drafts and request logs for 30 days.",
    "One call fell outside the approved scope: on Day 5 the Salesforce lookup service read a BillingAccount record. Everything else matched the approved scope.",
  ],

  phases: [
    {
      day: "Day 1",
      date: "Mon 5 Oct",
      title: "SSO setup in Okta",
      steps: ["Created SAML app for the agent console", "Assigned the 12-person Support-Pilot group", "Tested sign-in with a pilot user"],
      changes: [
        { ref: "cfg-okta-01", text: "Add SAML app \"Relay Support Agent\" with Northwind IdP metadata" },
        { ref: "cfg-okta-02", text: "Restrict app assignment to group Support-Pilot" },
      ],
      components: ["C1"],
    },
    {
      day: "Days 2-3",
      date: "Tue 6 - Wed 7 Oct",
      title: "Zendesk integration",
      steps: ["Built connector using a scoped API token", "Read open tickets and comment history", "Posted drafts as private notes (public: false)"],
      changes: [
        { ref: "a91c3e2", text: "zendesk: add ticket + comment fetch with pagination" },
        { ref: "4be07d1", text: "zendesk: write drafts as internal notes only; block public replies" },
        { ref: "c22f8a9", text: "zendesk: redact card numbers from ticket text before processing" },
      ],
      components: ["C2"],
    },
    {
      day: "Day 4",
      date: "Thu 8 Oct",
      title: "Salesforce policy lookup",
      steps: ["Connected with a read-only integration user", "Matched requester email to Contact", "Queried Policy__c for status and coverage"],
      changes: [
        { ref: "7d0e5b4", text: "salesforce: contact lookup by requester email" },
        { ref: "e18a6c0", text: "salesforce: policy lookup (Policy_Number__c, Status__c, Coverage_Type__c)" },
      ],
      components: ["C3"],
    },
    {
      day: "Day 5",
      date: "Fri 9 Oct",
      title: "Agent workflow and prompt configuration",
      steps: ["Added FAQ retrieval from claims-faq space", "Configured reply-drafting prompt and tone guide", "Added payment status fallback to policy lookup"],
      changes: [
        { ref: "0f4d2aa", text: "kb: search claims-faq and cite article IDs in drafts" },
        { ref: "b7c19e3", text: "agent: reply prompt v3, human review required before send" },
        { ref: "5a8e0f7", text: "salesforce: payment status fallback via BillingAccount", flagged: true },
      ],
      components: ["C4", "C5", "C3"],
    },
    {
      day: "Day 6",
      date: "Sat 10 Oct",
      title: "Testing on sample tickets",
      steps: ["Ran 40 sample tickets end to end", "Pilot staff reviewed draft quality", "Removed FDE test user from Okta app"],
      changes: [
        { ref: "9e2b6d1", text: "tests: 40 sample-ticket replay suite" },
        { ref: "cfg-okta-03", text: "Remove FDE test account from app assignment" },
      ],
      components: ["C2", "C3", "C1"],
    },
  ],

  components: [
    {
      id: "C1",
      name: "Okta SSO app",
      description: "SAML app so pilot staff sign in to the agent console with Northwind credentials.",
      systems: ["Okta"],
      permissions: ["App admin for \"Relay Support Agent\" only"],
      scopeIds: ["S1"],
    },
    {
      id: "C2",
      name: "Zendesk connector",
      description: "Fetches tickets and comments; posts drafts as private internal notes. Cannot post public replies.",
      systems: ["Zendesk"],
      permissions: ["API token: tickets:read, tickets:write (internal notes)"],
      scopeIds: ["S2", "S3"],
    },
    {
      id: "C3",
      name: "Salesforce lookup service",
      description: "Read-only integration user that matches the requester to a Contact and reads their Policy__c records.",
      systems: ["Salesforce"],
      permissions: ["Integration user, profile \"Relay Read Only\""],
      scopeIds: ["S4", "S5"],
      outOfScope: ["GET /sobjects/BillingAccount/{id}, added in change 5a8e0f7 (Day 5)"],
    },
    {
      id: "C4",
      name: "Knowledge base retriever",
      description: "Searches the claims-faq space and passes matching articles to the drafting agent.",
      systems: ["Northwind Help Center KB"],
      permissions: ["KB service account, space claims-faq read"],
      scopeIds: ["S6"],
    },
    {
      id: "C5",
      name: "Reply-drafting agent",
      description: "Combines ticket, policy and FAQ context, calls the model provider, and hands the draft to the Zendesk connector.",
      systems: ["Relay platform", "Model provider (external)"],
      permissions: ["No direct access to Northwind systems; works only through C2, C3, C4"],
      scopeIds: [],
    },
  ],

  dataFlow: [
    { id: "f1", label: "Zendesk ticket", sub: "Customer question + history", tags: [{ t: "PII", k: "pii" }] },
    { id: "f2", label: "Relay agent", sub: "Orchestrates the draft", tags: [{ t: "Ticket text sent to model provider", k: "ext" }] },
    { id: "f3", label: "Salesforce read", sub: "Contact + Policy__c lookup", tags: [{ t: "PII", k: "pii" }, { t: "Read only", k: "ok" }] },
    { id: "f4", label: "Draft reply", sub: "Generated, cites FAQ", tags: [{ t: "Stored 30 days (Relay)", k: "store" }] },
    { id: "f5", label: "Zendesk comment", sub: "Private note, human sends", tags: [{ t: "PII", k: "pii" }, { t: "Stays in Zendesk", k: "ok" }] },
  ],

  dataNotes: [
    { k: "pii", title: "Where PII moves", text: "Requester name, email and policy details move from Zendesk and Salesforce to Relay's platform, then back into Zendesk as a private note." },
    { k: "ext", title: "Model provider", text: "Ticket text and a policy summary are sent to Relay's model provider to generate the draft. Provider retention: none (zero-retention API terms)." },
    { k: "store", title: "What is stored, and for how long", text: "Relay stores the draft and a request log for 30 days, then deletes them. No Salesforce records are copied into Relay storage." },
  ],

  sendTo: "Northwind Security",
};
