# WorkVibe

A multi-tenant **restaurant management platform** whose notification layer is built on [SuprSend](https://www.suprsend.com). WorkVibe is not a notifications product — SuprSend is; WorkVibe is the vertical SaaS on top. Its business customers are restaurant chains, and the people its notifications reach are those chains' diners. For each chain, an admin can manage notification **templates** and **workflows**, **broadcast** to the whole subscriber list, deliver across **email, in-app inbox, and Slack**, manage **per-subscriber preferences**, and watch **executions** and **analytics** — all isolated per customer workspace.

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
| **Users** | Live SuprSend subscribers — add/remove, per-subscriber preferences, delivery log. |
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
scripts/          Seeding (provision.mjs) + asset push (push-assets.mjs)
suprsend/         The reference assets — CLI-native files, one folder per workspace
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
>
> **If you do need to put it somewhere reachable** — to show it to someone — set `DEMO_PASSWORD` on the deployment. `proxy.ts` then puts every page and API route behind that one shared password, which is enough to stop a stray URL exposing your SuprSend workspace. It is a demo gate, not authentication: everyone shares one password and, once past it, still acts as any user or admin. Leave the variable unset locally and the gate is off.

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

**6. Fill in the per-workspace keys.** Step 5 already filled each `<PREFIX>_WORKSPACE_KEY` (it equals the workspace UID, which the API returns). The remaining values exist only in the dashboard: for each workspace, open its API Keys page and paste the secret, signing key and public key into the blank lines step 5 added in `.env.local` (see the table below):

```
https://app.suprsend.com/en/<workspace-slug>/developers/api-keys
```

The `<workspace-slug>` in that URL can differ per account — copy it from your browser's address bar when viewing the workspace.

**7. Push the reference assets.** WorkVibe ships a starter kit of preference categories, templates and workflows for each demo workspace, as CLI-native files under `suprsend/<workspace>/`. Both demo customers are restaurant chains, so both get the same five default workflows — welcome, order confirmed, order ready, receipt, and sign-in alert — and each adds its own: a day-after feedback ask for Ember & Oak (casual dining, Austin); a delivery-arriving nudge and a broadcastable weekend deal for Nolan's Pizza (delivery-first, Denver). That standard-set-plus-additions shape is the point: real customers of one platform run mostly the same notifications and differ in small ways. This publishes the kit with the official `suprsend` CLI, per workspace, in dependency order (categories → templates → workflows):

```bash
npm run push:assets
```

Your account is the source of truth from here on: the app renders whatever the workspaces hold, so you can edit or add assets in the SuprSend dashboard freely — and `npx suprsend template pull -w <workspace> -d suprsend/<workspace>/templates` (same for `workflow` / `category`) brings dashboard edits back into these files if you want them versioned.

**8. Seed the demo data.** Branding (the tenant each template's `{{$brand.*}}` resolves through) and the demo subscribers — the data-plane pieces the CLI has no commands for:

```bash
node --env-file=.env.local scripts/provision.mjs brand
node --env-file=.env.local scripts/provision.mjs users
```

**9. Run the dev server.**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Optional — deploy.** The app deploys like any Next.js app (set the same env vars on the host). Set `DEMO_PASSWORD` so the whole demo sits behind one shared password — and remember a deployed demo talks to your **real** SuprSend account: anyone past the gate is sending real notifications from your workspaces.

### Environment variables

`<PREFIX>` is the workspace slug, uppercased with dashes → underscores — e.g. slug `workvibe-emberoak` → `SUPRSEND_WORKVIBE_EMBEROAK` (public vars are prefixed `NEXT_PUBLIC_`).

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

> **Note — workspace creation.** Step 5 is idempotent: it lists existing workspaces first and reuses them by name, so re-running never duplicates, and it never overwrites an env value you've already filled. It auto-fills only the Workspace Key; the secret, signing key and public key are shown once in the dashboard and returned by no API, so those stay manual pastes.
>
> **Note — the reference assets.** The kit under `suprsend/<workspace>/` is a starter, not a contract: push it, replace it, or ignore it and build everything in the dashboard — the app reads the account either way. The files themselves were pulled from live workspaces with the CLI, so they are exactly what `pull` produces. Re-running `npm run push:assets` is safe: an unchanged asset commits as a no-op, and a dashboard edit you haven't pulled back is overwritten only for the assets the kit also defines — pull first if you want to keep dashboard edits.
>
> **Note — the list-entry welcome.** The hub API silently ignores `track_user_entry` when provisioning creates the `all-subscribers` list, and offers no call to change it afterwards — the flag can only be enabled from the list's page in the dashboard. Do that **before** running `provision.mjs users`: a member who joins while tracking is off never emits `$USER_ENTERED_LIST`, is never welcomed, and won't re-enter on a re-run. The `users` stage checks the flag and warns when it's off.
>
> Redeploying the app does **not** re-run any of this. Provisioning and seeding are one-time (or on-demand) commands a developer runs locally; the build/deploy pipeline only runs `next build`.

### Configuring additional workspaces

Workspaces are declared in `lib/workspaces.ts`. Add an entry there, re-run the provision command, and fill the new env lines. See [`.env.example`](.env.example) for the full list and naming convention.

---

## SuprSend integration notes

Everything the app does rides on four SuprSend surfaces (all request shapes verified against the live API):

- **Templates — management API v2** (`/v2/{ws}/template/…`, account `ServiceToken`): list/get, metadata + per-channel variant writes, and a `PATCH …/commit/` that publishes a draft live. `lib/suprsend-mgmt.ts` is the app's client; the same objects live on disk as the CLI files under `suprsend/<workspace>/templates/`.
- **Workflows — management API v1** (`/v1/{ws}/workflow/{slug}/?commit=true`): one POST publishes the whole definition. The app's AI-authoring flow publishes a workflow's templates first, then the workflow, so a half-published journey can't go live.
- **Preference categories — management API v1** (`/v1/{ws}/preference_category/`): reads return the full three-root tree (system / transactional / promotional); writes are a POST of the **full tree** back (PATCH/PUT return 405), which is why the app re-reads live state and merges edits by slug before saving.
- **Hub — node SDK** (`hub.suprsend.com`, per-workspace key + secret): users, tenants/brand, lists, triggers, broadcasts, and per-subscriber preferences. This is the data plane — the CLI has no commands for it, which is exactly the split between `npm run push:assets` (assets, CLI) and `scripts/provision.mjs` (data, SDK/API).

Gotchas that cost real debugging time are documented where they bite, as comments in `lib/server/*` and the scripts — e.g. the workspace-level flag without which subscriber preferences silently omit the inbox channel (`scripts/push-assets.mjs`), and the `track_user_entry` flag the hub API accepts but ignores (`scripts/provision.mjs`).

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
| `npm run push:assets` | Publish the reference assets (`suprsend/<workspace>/`) with the SuprSend CLI — categories → templates → workflows, committed live. Add `-- --dry-run` to preview |
| `node --env-file=.env.local scripts/provision.mjs brand` | Set each workspace's tenant brand (`scripts/seed-data/brands.json`) — templates render `{{$brand.*}}` through it |
| `node --env-file=.env.local scripts/provision.mjs users` | Seed the demo subscribers (`scripts/seed-data/users.json`) and fire onboarding for each newly created one |
| `npm run seed` | provision.mjs workspaces + brand + users, in order |

---

## License

See [LICENSE](LICENSE).
