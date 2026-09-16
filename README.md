# WorkVibe × SuprSend: notifications reference app

A Next.js app that shows how a B2B2C product wires up SuprSend notifications. **WorkVibe** is a demo
restaurant platform. Its customers are restaurant chains, and its notifications reach their diners. It covers
templates, workflows, broadcasts, per-subscriber preferences, branding, an in-app inbox, and delivery logs.

Every screen makes real SuprSend API calls.

**What you'll set up.** Each WorkVibe customer is a SuprSend workspace. Setup creates two, **Ember & Oak**
and **Nolan's Pizza**, so you can see that workspaces are isolated. The repo ships no demo data: you set the
brand and add subscribers in the app.

> Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/Radix UI.
> SDKs: `@suprsend/node-sdk`, `@suprsend/react`, `@suprsend/react-editor`.

**Contents**

1. [Getting started](#getting-started): set up and run the app
2. [SuprSend integration notes](#suprsend-integration-notes): which API does what
3. [Repository layout](#repository-layout)
4. [Scripts](#scripts)

---

## Getting started

**You need:** Node.js 20+ and a SuprSend account.

### 1. Install

```bash
git clone https://github.com/yashika248/workvibe-reference.git
cd workvibe-reference
npm install
```

### 2. Create the workspaces

Get an account service token from the SuprSend dashboard: **Account Settings → Service Tokens**.
Copy the env template and paste the token into `SUPRSEND_SERVICE_TOKEN`:

```bash
cp .env.example .env.local
```

Then create the two workspaces:

```bash
npm run create:workspaces
```

This creates **Ember & Oak** and **Nolan's Pizza** (or reuses them if they exist) and fills in each
workspace's Workspace Key in `.env.local`. It's safe to run again: it never overwrites a value you've filled.

### 3. Paste the remaining keys

Each workspace needs four more values. No API returns them, so copy them from the dashboard: switch to the
workspace, then **Developers → API Keys**.

| Variable | Where to find it |
|---|---|
| `SUPRSEND_<WS>_WORKSPACE_SECRET` | **Workspace Key and Secret** (shown once) |
| `NEXT_PUBLIC_SUPRSEND_<WS>_PUBLIC_KEY` | **Public Keys**: the `SS.PUBK…` value |
| `SUPRSEND_<WS>_SIGNING_KEY_UID` | **Signing Keys**: the `signing_key_…` UID, not the `ws_signk_…` ID |
| `SUPRSEND_<WS>_SIGNING_KEY_B64` | **Signing Keys**: the private key PEM, base64-encoded (command below) |

`<WS>` is `WORKVIBE_EMBEROAK` or `WORKVIBE_NOLANS`. To encode the signing key:

```bash
base64 -i signing-key.pem | tr -d '\n'
```

### 4. Push the notification setup

The preference categories, templates, and workflows are files in `suprsend/`, in the layout
[SuprSend's CLI](https://docs.suprsend.com/reference/cli-intro) uses. Both chains share five workflows
(welcome, order confirmed, order ready, receipt, sign-in alert). Ember & Oak adds a feedback ask; Nolan's adds
a delivery nudge and a weekend deal. Preview, then push to both workspaces:

```bash
npm run push:assets -- --dry-run
```

```bash
npm run push:assets
```

After this, SuprSend holds the live copy. Changes you make in the dashboard show up in the app.

> **Pushing again overwrites templates.** If you edited a template in the SuprSend editor, pull it first:
> `npx suprsend template pull -w workvibe-emberoak -d suprsend/workvibe-emberoak/templates`.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The workspace switcher lists every workspace whose keys
are in `.env.local`. If it shows none, check the keys and restart the dev server.

### 6. Set each workspace's brand

In **Brand Settings**, set the name, colours, logo, and website. Templates render `{{$brand.*}}` from it, and
the switcher shows its name and colour. Without it, emails are signed with your SuprSend account name, and the
welcome's "Browse the menu" button has no link.

### 7. Add subscribers

1. Open **Users**. The first visit creates the `all-subscribers` list.
2. If the page says the welcome is off: in the dashboard, open that list and turn on **Track user entry**.
   Do this before adding anyone. People added while it's off are never welcomed, and the API can't turn it on.
3. Use **Add subscriber** for each person.

Email delivery needs an email vendor (**Vendors** in the dashboard). The in-app inbox works without one.

> **Where the assets are stored:** `suprsend/<workspace>/` in this repo, one folder per workspace, with
> `preference_categories/`, `templates/`, and `workflows/`. Edit them there and run `npm run push:assets`.
> To copy dashboard edits back, run `npx suprsend <template|workflow|category> pull -w <workspace>`.

### Deploying

The app runs anywhere Next.js runs, e.g. Vercel. It has no login. To share a demo, set `DEMO_PASSWORD` on the
deployment and every page and API route asks for that password (`proxy.ts`). A deployed demo reads and writes
your real SuprSend account.

> **Using this in a real product?** Two routes are simplified for the demo.
> [`/api/subscriber-token`](app/api/subscriber-token/route.ts) takes `distinct_id` from the query string;
> take it from your logged-in session instead. [`/api/editor-token`](app/api/editor-token/route.ts) grants
> access to every template (`entity_id: "*"`); scope it and limit the route to admins.

### Adding a workspace

No code change. Create the workspace in the dashboard, add its keys to `.env.local` under its slug's prefix
(`workvibe-foo` → `SUPRSEND_WORKVIBE_FOO_…`), and restart the dev server.

---

## SuprSend integration notes

The app reads everything from SuprSend: workspaces, subscribers, lists, brand, templates, workflows,
categories, and logs. With no data, screens show an empty state.

| Surface | Host / package | Auth | Used for |
|---|---|---|---|
| **Management API** | `management-api.suprsend.com` | `ServiceToken` | Workspace list, templates (v2), workflows (v1), preference categories (v1) |
| **Node SDK** | `@suprsend/node-sdk` → `hub.suprsend.com` | Workspace key + secret | Subscribers, lists, brand, triggers, broadcasts, logs |
| **Hub REST** | `hub.suprsend.com` | HMAC signature (list members) or ES256 token (preferences) | List members, per-subscriber preferences. The SDK has no call for either |
| **React SDK** | `@suprsend/react`, `@suprsend/react-editor` | ES256 token signed by this app | Inbox, template editor |

- **Preference categories:** writes are a POST of the **full tree** (PATCH/PUT return 405), so the app re-reads
  live state and merges edits by slug before saving.
- **Workflows:** `POST /api/workflows` publishes a workflow's templates first, then the workflow, so a
  half-published journey can't go live. No screen calls it — it's there for your own code. Same for
  `POST /api/templates`.
- Gotchas are documented where they bite: the inbox preference flag (`scripts/push-assets.mjs`) and the
  ignored `track_user_entry` flag (`lib/server/users.ts`).

### Environment variables

| Variable | Scope | Used for |
|---|---|---|
| `SUPRSEND_SERVICE_TOKEN` | Account | Management API for every workspace |
| `SUPRSEND_<WS>_WORKSPACE_KEY` / `_SECRET` | Workspace | Node SDK. A matching key also makes the workspace appear in the app |
| `SUPRSEND_<WS>_SIGNING_KEY_UID` / `_B64` | Workspace | Signs inbox and editor tokens |
| `NEXT_PUBLIC_SUPRSEND_<WS>_PUBLIC_KEY` | Workspace | Inbox and subscriber preferences |
| `NEXT_PUBLIC_APP_URL` | App | This app's base URL |
| `DEMO_PASSWORD` | Deployment | Password for a shared demo. Leave empty locally |
| `SUPRSEND_MGMNT_URL`, `SUPRSEND_HOST` | Optional | API hosts, for a private or regional cluster |

`.env.local` is gitignored. See [`.env.example`](.env.example) for the full list.

---

## Repository layout

```
app/
  admin/          Admin surfaces (templates, workflows, broadcast, executions, analytics, users, …)
  user/           End-user surfaces (inbox, preferences)
  api/            Route handlers — the only place that talks to SuprSend
components/        Client components (one *-client.tsx per surface) + shared UI
lib/
  server/         Server-only SuprSend access (node SDK + management API)
  wf/             Workflow canvas derivation
scripts/          Workspace creation (create-workspaces.mjs) + asset push (push-assets.mjs)
suprsend/         The assets — CLI-native files, one folder per workspace
  <workspace>/
    preference_categories/
    templates/
    workflows/
public/wf-engine.js   Canvas rendering engine
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / run |
| `npm run lint` / `typecheck` / `test` | ESLint / TypeScript / Vitest |
| `npm run create:workspaces` | Create Ember & Oak and Nolan's Pizza and fill their Workspace Keys |
| `npm run push:assets` | Push `suprsend/` to both workspaces. `-- --dry-run` to preview |
| `node --env-file=.env.local scripts/fire-test.mjs <workspace> <workflow> <distinct_id>` | Fire one workflow at a subscriber |

## License

See [LICENSE](LICENSE).
