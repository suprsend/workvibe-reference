# WorkVibe — Build Notes (empirically verified)

Auth: `Authorization: ServiceToken <SUPRSEND_SERVICE_TOKEN>` (account-scoped, one for all workspaces).
Base: `https://management-api.suprsend.com`. Workspace = URL path segment.

## Templates (v2)

| Step | Method + path | Notes |
|---|---|---|
| List | `GET /v2/{ws}/template/?limit=` | `{meta:{count}, results:[…]}` |
| Get | `GET /v2/{ws}/template/{slug}/` | draft view; `channels:[{channel,is_active,variants_count}]` |
| Create / update metadata | `POST /v2/{ws}/template/{slug}/` | body `{name, description, tags, enabled_channels:["email","inbox"]}` → 201, auto-creates one `default` variant per channel |
| Set variant content | `POST /v2/{ws}/template/{slug}/channel/{ch}/variant/default/` | body `{channel,id:"default",tenant_id:null,locale:"en",conditions:[],content:{…}}` |
| **Publish** | `PATCH /v2/{ws}/template/{slug}/commit/?commit_message=` | → `status:"active", version_no:N` |
| Delete | `DELETE /v2/{ws}/template/{slug}/` | 204 |

Variant allowed methods: `GET, POST, DELETE`. Commit endpoint allowed method: `PATCH` only.

### Email content
```json
{"templating_language":"handlebars","subject":"…",
 "body":{"type":"designer",
   "designer":{"html":"…","text":"","merge_tags":[],"design_json":{},"display_conditions":[]},
   "preheader":"","plain_text":null,"email_markup":""}}
```
Required: `subject`, `body.designer.html`.

### Inbox content
```json
{"templating_language":"handlebars","schema_version":"1.0",
 "header":"… (title)","body":"… (message)",
 "action_url":"","open_in_new_tab":false,"image_url":"","subtext":null,
 "importance":"default","avatar":null,"tags":[],"is_expiry_enabled":false,
 "expiry":null,"is_pinned":false,"buttons":[],"extra_data":""}
```
Required: `body`. `header` = inbox title.

## Workflows (v1) — from BTS, carries over

| Step | Method + path |
|---|---|
| List | `GET /v1/{ws}/workflow/?mode=live&limit=` |
| Get | `GET /v1/{ws}/workflow/{slug}/` |
| Publish | `POST /v1/{ws}/workflow/{slug}/?commit=true&commit_message=` |

Jsonnet quoting still applies inside `httpapi_fetch` + `branch` nodes (server auto-quotes).

## Categories (v1)
- `GET/PATCH /v1/{ws}/preference_category/` — roots: system / transactional / promotional ship by default.

## hub.suprsend.com (node SDK only)
Users, tenants, lists, triggers, per-user preferences. Needs SDK signature auth (workspace key+secret) — not raw curl.
