# RESILIENCE.md — Erupt

External service dependencies, risk profiles, and mitigation strategies.
Update this file whenever a new external dependency is introduced or a mitigation changes.

Status: Pre-launch. Planned dependencies are marked accordingly.

---

## AI / Proxy

| Dependency | Role | Risk | Mitigation |
|---|---|---|---|
| Anthropic API | Core extraction AI (Free/BYOK + Cloud plans) | **HIGH** — Cloud plan non-functional without it | BYOK plan: ban affects individual user only, not Slipstream. Cloud plan: multi-key rotation + rate-limit monitoring. Long-term: support OpenAI / Gemini as BYOK alternatives so users aren't locked to Anthropic. |
| Ollama (user-hosted) | Local plan AI | **NONE** — fully self-hosted by user | No dependency on Slipstream infrastructure. No mitigation needed. |
| api.slipstream.now proxy *(planned)* | Cloud plan request routing | **HIGH** — single point of failure for Cloud plan | Deploy to at least two regions (primary: Railway; standby: Fly.io or Render). Health check endpoint required. Plugin must surface a clear "proxy unreachable" error rather than silently failing. |

---

## Payments

| Dependency | Role | Risk | Mitigation |
|---|---|---|---|
| Stripe *(planned)* | Cloud plan billing | **HIGH** — deplatforming risk | Paddle or Braintree as warm backup before v2 (see TODOS.md). Never use Stripe-specific language in checkout copy — use "personal knowledge management" / "AI session notes" throughout all product descriptions, metadata, and email. |

---

## Auth

| Dependency | Role | Risk | Mitigation |
|---|---|---|---|
| auth.slipstream.now *(planned)* | Cloud plan JWT issuance | **HIGH** — if unreachable, Cloud users can't authenticate | Self-hosted auth service — avoid Auth0/Clerk/Firebase. JWT validation is stateless; tokens remain valid until expiry even if auth service is temporarily down. Set token lifetime to 7–30 days to survive short outages. |

---

## Distribution

| Dependency | Role | Risk | Mitigation |
|---|---|---|---|
| Obsidian Community Plugins registry | Primary discovery channel | **HIGH** — Obsidian can reject or remove plugin | GitHub Releases is always the canonical artifact source (`main.js` + `manifest.json` + `styles.css`). Users can install directly from GitHub without the community registry. Document sideload instructions prominently on the marketing site. |
| GitHub Releases | Plugin artifact hosting | **LOW** — unlikely ban; git is portable | Mirror release artifacts to an S3-compatible bucket or self-hosted file server as backup. |

---

## Infrastructure

| Dependency | Role | Risk | Mitigation |
|---|---|---|---|
| GitHub | Source code + release hosting | **LOW** | Local git is the source of truth. Mirror to Codeberg or self-hosted Gitea if needed. |

---

## Email / Communications

| Dependency | Role | Risk | Mitigation |
|---|---|---|---|
| *(none currently)* | — | — | When transactional email is added: use an abstraction layer (`IMailer`) and maintain a warm second SMTP provider. |
