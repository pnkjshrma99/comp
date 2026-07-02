Here's a comprehensive guide to Comp AI and what you can explore/test:
What is Comp AI?
Open-source compliance automation platform. It helps companies achieve SOC 2, ISO 27001, GDPR (and other frameworks) compliance with AI-powered policy generation, evidence collection, risk management, and vendor oversight.
Full Product Map
Module Route
Overview /overview
Frameworks /frameworks
Policies /policies
Evidence /tasks
Documents /documents
People /people
Risks /risk
Vendors /vendors
Integrations /integrations
Cloud Tests /cloud-tests
Security /security/penetration-tests
Questionnaire /questionnaire
Trust Portal /trust
Auditor View /auditor
Settings /settings
Step-by-Step Walkthrough

1. Explore What's Already Set Up

- Go to Overview — see the compliance score (it's based on your seeded frameworks)
- Go to Frameworks — see all 23 frameworks already seeded (SOC 2, ISO 27001, HIPAA, GDPR, etc.)
- Go to Policies — you'll see 52 policy templates already generated

2. Add Your Org Context (Important!)
   Go to Settings → Context Hub — fill in:

- Company background, industry, team size
- Infrastructure details (cloud providers, tools)
- Data types you handle
- This feeds ALL the AI features (policy gen, questionnaires, risk assessment)

3. Test AI Policy Features

- Go to Policies, click a policy → opens the editor
- On the right, open the AI chat — ask it to edit or expand the policy
- Try: "Add a section about data retention for EU users"
- The AI uses Groq (llama-3.1-8b-instant) to propose changes

4. Add Frameworks & Generate Policies

- Not working fully — automated policy generation on framework add runs via Trigger.dev (not running)
- But you can manually create policies or use the AI chat to write them

5. Manage Vendors & Risk

- Go to Vendors → Add Vendor (name, website, category)
- The AI risk assessment requires Firecrawl + Trigger.dev, so it won't auto-run
- But you can manually set risk levels: edit vendor → set inherent/residual probability & impact
- Go to Risks → Create risk to build your risk register manually

6. Evidence Collection Workflow

- Go to Evidence (/tasks)
- Each control has associated tasks
- Click a task → upload files as evidence
- Complete tasks to improve your compliance score

7. Manage People

- Go to People → see members, invite new ones
- Roles: owner, admin, auditor, employee, contractor
- Go to Settings → Roles to create custom roles with granular permissions
  What's Blocked / Needs External Services
  Feature
  Auto policy generation on framework add
  Vendor AI risk assessment
  Auto-link risks/vendors to controls
  Evidence automations
  Email notifications/invites
  SaaS integrations for auto-evidence
  Cloud security scanning
  Employee portal
  Penetration testing
  What You CAN Test Right Now

1.  Full auth flow — sign in/out, session persists
2.  Policy editor + AI chat — write/edit policies with Groq AI
3.  Framework browsing — explore all 23 frameworks and their controls
4.  Manual evidence upload — create tasks, upload files
5.  Risk register — manually add risks with treatment strategies
6.  Vendor management — add vendors, manually assess risk
7.  People management — invite members, assign roles
8.  Settings — configure org context, API keys, custom roles
9.  Trust portal — configure public compliance page
10. Auditor view — see what auditors would see
    Quick Test Checklist

- Browse all pages in the sidebar
- Open a policy → use AI chat to modify it
- Add a framework (try SOC 2)
- Go to Evidence → view tasks for controls
- Go to Vendors → add a test vendor
- Go to Risks → create a risk with treatment
- Settings → Context Hub → fill in org details
- Settings → Roles → explore permission matrix
- Settings → API Keys → create an API key
