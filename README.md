# WorkVibe

A multi-tenant **customer-notification platform** built on [SuprSend](https://www.suprsend.com). WorkVibe lets an admin manage notification **templates** and **workflows**, **broadcast** to the whole subscriber list, deliver across **email, in-app inbox, and Slack**, manage **per-subscriber preferences**, and watch **executions** and **analytics** — all isolated per customer workspace.

It doubles as a reference implementation of the SuprSend management API, node SDK, embedded template editor, and React inbox/preference components in a real Next.js App Router app.

> Built with Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, and shadcn/Radix UI.

---

## Features

| Area | What it does |
|---|---|
| **Templates** | Multi-channel content (email, inbox, SMS, WhatsApp, Slack) edited in the embedded SuprSend editor. |
| **Workflows** | Notification journeys — triggers, waits, branching (wait-for-response, conditions) — rendered on a canvas, with per-user Send-test. |
| **Executions** | Live message log + grouped per-run view (status, per-channel delivery, resend). |
| **Analytics** | Delivery/open funnel, by-channel and by-template/workflow breakdowns, opt-out metrics. |
| **Broadcast** | Send one promotional template to every subscriber on the `all-subscribers` list in a single call. |
| **Preferences** | Workspace defaults + per-subscriber category/channel preferences, with "required" (non-unsubscribable) categories. |
| **Users** | Live SuprSend subscribers — add/edit/remove, role, preferences, delivery log. |
| **Branding** | Per-workspace tenant brand (logo, colours) applied to emails and the inbox. |
| **Multi-tenant** | Each workspace is its own isolated SuprSend workspace; switch in the top bar. |

---

## Architecture

```
app/
  admin/          Admin surfaces (templates, workflows, broadcast, executions, analytics, users, …)
  user/           End-user surfaces (inbox, preferences)
  api/            Route handlers — the only place that talks to SuprSend
components/        Client components (one *-client.tsx per surface) + shared UI
lib/
  server/         Server-only SuprSend access (node SDK + management API)
  wf/             Workflow canvas derivation
scripts/          Provisioning (provision.mjs)
public/wf-engine.js   Canvas rendering engine
```

**Key conventions**

- **Server/client split.** Pages are thin server wrappers that delegate to `*-client.tsx` components. Components import server modules with `import type` only (erased at build) — secrets never reach the browser.
- **Two SuprSend surfaces.** The management API (`management-api.suprsend.com`, templates/workflows) uses the account `ServiceToken`. The hub (`hub.suprsend.com`, users/triggers) uses the per-workspace key+secret via the node SDK.
- **Multi-tenant env keys.** Each workspace's credentials are read from env vars whose prefix is derived from its slug — see [`.env.example`](.env.example).

---

## Getting started

> **⚠️ Security note — this demo has no authentication.**
>
> WorkVibe is meant to run **locally only**. There is no login, and no request is checked against a session, so anyone who can reach the app can act as any user or admin. **Do not deploy it to the public internet as-is.**
>
> Two routes in particular mint SuprSend JWTs for any caller. Before reusing these patterns in production:
>
> - **`app/api/subscriber-token/route.ts`** takes `distinct_id` from a query parameter. Derive it from your app's authenticated server-side session instead — never from client input — or a caller can read anyone's notification feed.
> - **`app/api/editor-token/route.ts`** issues a token scoped to `entity_id: "*"`, i.e. every template in the workspace. Gate this route to admin users, and narrow the scope to specific templates where you can.

### Prerequisites

- Node.js 20+
- A [SuprSend](https://app.suprsend.com) account

### Setup

**1. Clone the repo** and move into it. Every command below is run from this directory.

```bash
git clone https://github.com/yashika248/workvibe-reference.git
cd workvibe-reference
```

**2. Install dependencies.**

```bash
npm install
```

**3. Create your local env file** from the template.

```bash
cp .env.example .env.local
```

**4. Add your Service Token.** In the dashboard go to **Account Settings → Service Tokens**, create one, and paste it into `.env.local` as `SUPRSEND_SERVICE_TOKEN`. This is the one account-wide credential needed to create workspaces at all — everything below depends on it being set first.

**5. Create the workspaces.** This reads the workspaces declared in `lib/workspaces.ts`, creates any that don't exist in your account (reusing the rest), and appends blank credential lines to `.env.local` for you to fill.

```bash
node --env-file=.env.local scripts/provision.mjs workspaces
```

> This step must run — and succeed — **before** step 6. A workspace's API Keys page in the dashboard doesn't exist until the workspace itself exists; there is nothing to copy keys from until this command creates (or confirms) the workspace.

**6. Fill in the per-workspace keys.** *Only after step 5 has created/confirmed the workspaces:* for each one, open its API Keys page and paste the values into the matching blank lines step 5 just added in `.env.local` (see the table below):

```
https://app.suprsend.com/en/<workspace-slug>/developers/api-keys
```

The `<workspace-slug>` in that URL can differ per account — copy it from your browser's address bar when viewing the workspace.

**7. Seed the content.** WorkVibe ships with a working set of branding, preference categories, templates, workflows and demo subscribers for each demo workspace — trip updates, receipts and ride offers for Loopride; outage, billing and equipment notifications plus product news for Northwind. This publishes all of it into your freshly-created workspaces, in the required order:

```bash
node --env-file=.env.local scripts/provision.mjs all
```

**8. Run the dev server.**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

`<PREFIX>` is the workspace slug, uppercased with dashes → underscores — e.g. slug `workvibe-loopride` → `SUPRSEND_WORKVIBE_LOOPRIDE` (public vars are prefixed `NEXT_PUBLIC_`).

| Variable | Where to find it |
|---|---|
| `SUPRSEND_SERVICE_TOKEN` | Account Settings → Service Tokens |
| `SUPRSEND_MGMNT_URL`, `SUPRSEND_HOST` | Defaults shown in `.env.example`; override only for a private/region cluster |
| `NEXT_PUBLIC_APP_URL` | This app's base URL (e.g. `http://localhost:3000`) |
| `<PREFIX>_WORKSPACE_KEY` | Workspace → Developers → API Keys → **Workspace Key and Secret** (the Key; equals the workspace UID) |
| `<PREFIX>_WORKSPACE_SECRET` | Same section, the **Secret** (dashboard-only — no API returns it) |
| `<PREFIX>_SIGNING_KEY_UID` | Same page → **Signing Keys** → the **Signing Key UID** column (value starts `signing_key_`) |
| `<PREFIX>_SIGNING_KEY_B64` | The signing key's PEM private key, base64-encoded (see note below) |
| `NEXT_PUBLIC_<PREFIX>_PUBLIC_KEY` | Same page → **Public Keys** (value starts `SS.PUBK`) |
| `<PREFIX>_SLACK_WEBHOOK` | Optional — a Slack incoming-webhook URL to enable the Slack channel |

> **Signing key:** use the **Signing Key UID** (`signing_key_…`) — not the "Signing Key ID" (`ws_signk_…`).

To base64-encode the signing key PEM for `<PREFIX>_SIGNING_KEY_B64`:

```bash
base64 -i signing-key.pem | tr -d '\n'
```

> **Note — workspace creation.** Step 5 is idempotent: it lists existing workspaces first and reuses them by name, so re-running never duplicates. It creates the *workspace* only — not the public/signing/API keys, because those dashboard values don't map 1:1 to the app's variables (the Workspace Key+Secret is the SDK's HMAC pair, distinct from the REST "API Key," which the app does not use). Create the workspace with the script; paste the keys yourself.
>
> **Note — content seeding.** Step 7's categories, templates, and workflows are ported verbatim from the working set this app was built and tested against — not placeholder copy. All three stages publish through the same commit flow the app itself uses, so re-running them is safe.
>
> Redeploying the app does **not** re-run any of this. Provisioning and seeding are one-time (or on-demand) commands a developer runs locally; the build/deploy pipeline only runs `next build`.

### Configuring additional workspaces

Workspaces are declared in `lib/workspaces.ts`. Add an entry there, re-run the provision command, and fill the new env lines. See [`.env.example`](.env.example) for the full list and naming convention.

---

## SuprSend API reference

[`BUILD_NOTES.md`](BUILD_NOTES.md) documents the SuprSend endpoints this app uses — templates (v2), workflows (v1), categories, and the hub/node-SDK surface — with verified request shapes and gotchas.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm test` | Run the unit tests (Vitest) |
| `node --env-file=.env.local scripts/provision.mjs workspaces` | Create/reuse workspaces and scaffold their env lines |
| `node --env-file=.env.local scripts/provision.mjs brand` | Set each workspace's tenant brand (`scripts/seed-data/brands.json`) — run before `templates`, which render `{{$brand.*}}` |
| `node --env-file=.env.local scripts/provision.mjs categories` | Publish the seed preference categories (`scripts/seed-data/categories.json`) — must run before `workflows` |
| `node --env-file=.env.local scripts/provision.mjs templates` | Publish the seed templates (`scripts/seed-data/templates.json`) |
| `node --env-file=.env.local scripts/provision.mjs workflows` | Publish the seed workflows (`scripts/seed-data/workflows.json`) |
| `node --env-file=.env.local scripts/provision.mjs users` | Seed the demo subscribers (`scripts/seed-data/users.json`) and fire onboarding for each newly created one |
| `node --env-file=.env.local scripts/provision.mjs all` | Run every stage above, in order |

---

## License

See [LICENSE](LICENSE).
