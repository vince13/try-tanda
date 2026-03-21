# Admin tools (private)

These files are **not** for public investor pages. They help operators produce **weekly / ad-hoc investor updates** (e.g. FasterCapital format) by filling a form and copying or downloading the result.

## Security

- **GitHub Pages** serves the whole repo as **public static files**. Anyone who guesses the URL can open them. **Do not rely on “secret links.”**
- **Recommended:** use this tool **locally only** (open the HTML file from disk, or run a local server from this folder).
- If you need it on `app.tanda.media`, put **`/admin-tools/`** behind **real access control** (e.g. Cloudflare Access, Basic Auth on the host, or a private Netlify deploy)–not client-side passwords in HTML.

## Investor update generator

1. Open `investor-update-generator.html` in a browser (double-click, or `python3 -m http.server 8765` from `admin-tools/` and visit `http://127.0.0.1:8765/investor-update-generator.html`).
2. Fill the sections; press **Apply template** to load the FasterCapital-style skeleton.
3. **Site & web traffic (monthly):** paste figures from Cloudflare, Plausible, GA, or other tools—always note the **month** and **definition** (unique visitors vs requests, which hostnames) so week-to-week numbers are comparable.
4. The **Preview** updates **as you type**; drafts auto-save shortly after you stop typing (localStorage in this browser). **Refresh preview & save now** forces an immediate save. Use **Clear draft** to reset.
5. Use **Copy full update**, **Copy bullets only** (preview stays the full letter), or **Download .txt**.

## robots.txt (if you ever deploy the parent site)

If `admin-tools` is accidentally on a public host, add:

```
User-agent: *
Disallow: /admin-tools/
```

Better: do not deploy this folder to public hosting without protection.
