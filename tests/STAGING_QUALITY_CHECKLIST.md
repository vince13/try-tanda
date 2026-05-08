# Staging, quality, and config checklist (Tanda web + API)

Use this document for **release sign-off**. It does not replace automated tests; it records what humans verify on **staging** (and optionally **production**) before calling a launch done.

---

## 1. Staging end-to-end (web + API)

Run logged-in against **staging API** URL configured via `<meta name="api-base-url">` or hostname defaults in `js/super-affiliate-api.js`.

| Step | Action | Pass criterion |
|------|--------|----------------|
| 1 | Open `super-affiliate-login.html`, sign in | Session stored; redirect works |
| 2 | **Purchase** | Add to cart → checkout → Paystack test → order appears in `orders.html` |
| 3 | **Seller** | `seller-orders.html` — load list, change status or add tracking (if applicable) |
| 4 | **Wallet** | `wallet.html` — balance loads; transactions list or retry on failure |
| 5 | **Admin gate** | Non-admin user: open `admin-tools/strategic-analysis.html` → **access denied** page (or login), not content |
| 6 | **Admin** | Admin user: same URL loads after guard |

Record date, environment URLs, and tester.

---

## 2. iOS Safari smoke (same flows)

On **iPhone** (or Simulator Safari), repeat a **subset**: login, feed scroll (**For you** and **Trending** on `feed.html`), add to cart / checkout start, wallet read, one seller sheet if available; **`help-support.html`** — send text + **attach** a small image (multipart); if piloting riders or village agents, smoke **`driver-dashboard.html`** (including disputes if applicable), **`rider-kyc.html`**, and **`village-hub.html`** **Start a batch** (agent-only). Note: safe-area padding on key pages (`wallet.html`, `cart.html`, `checkout.html`, `feed.html`).

---

## 3. CORS / origins

1. Identify **exact** browser origin(s) for the static site (e.g. `https://your-org.github.io`, `https://app.tanda.media`).
2. In Django: `CORS_ALLOWED_ORIGINS` (and duplicate lists in `production_settings.py`, `render_settings.py`, `railway_settings.py` if used).
3. Redeploy API; from browser devtools **Network**, confirm preflight and API calls succeed (no CORS block on `GET`/`POST` with `Authorization`).

---

## 4. Secrets and static config

| Check | Action |
|-------|--------|
| No live keys in git | Search static repo: ripgrep for `sk_live`, long static `Bearer ` tokens, private API keys |
| Paystack / keys | Public **client** keys only in frontend if required; secrets in env / backend |
| API base | Prefer `<meta name="api-base-url" content="https://…/api">` per deploy; avoid one-off hardcoded API hosts in new pages |

---

## 5. Rider / driver console (web MVP)

Web complements the app for pilot sign-off. Verify on **staging**; repeat **§2** on **iOS Safari** for multipart and tab UX.

| Step | Action | Pass criterion |
|------|--------|----------------|
| 1 | **`driver-dashboard.html`** — mine jobs, hub scan, pickup/deliver | Actions succeed; errors are user-visible |
| 2 | **Disputes** — eligible **mine** job: open dispute, load thread, send message | Thread loads; message posts; row status / panel matches API after refresh |
| 3 | **`rider-kyc.html`** — full multipart KYC (as applicable to account state) | Submit completes or validation/403 messages are clear; large photo upload does not silently time out |
| 4 | **`village-hub.html`** — **Start a batch** | Approved village agent: `POST /commerce/village/batches/` succeeds → redirect to `village-batch.html?id=`; non-agent sees gate or clear **403** |
| 5 | **`feed.html`** — **Trending** vs **For you** | Tab switch works; trending feed loads; empty copy differs from personalized feed |
| 6 | **`help-support.html`** — **attachment** | Start/resume ticket → **Attach file** → send image or PDF (optional caption); thread shows preview or link; **400** if oversize (over 25MB) |

For cross-client parity, repeat **step 6** in the app **Support** screen (file picker + send).

## 6. Admin tools split (normative)

| Surface | Use |
|---------|-----|
| **In-site `admin-tools/`** | Internal narrative, investor update drafting — **no** live money movement; client guard + host protection |
| **Django admin** | Rare data fixes, permissions, break-glass — **source of truth** for model edits when no product UI exists |
| **`admin_dashboard_screen.dart`** | Do **not** rebuild on web unless product explicitly asks for parity with that screen |

---

## Backend parity note (2026-05)

Ads **admin_management** and **moderation** admin actions use `users.tanda_roles.is_tanda_web_admin_user` (same rule as web: `is_staff` OR `is_superuser` OR `role == 'admin'`). Wallet admin endpoints use **Django permissions** with superuser / `role == 'admin'` per `_has_wallet_admin_access` in `wallet/views.py`.
