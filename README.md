# GeoSuite Open — GEO toolkit landing

A tiny static [Cloudflare Worker](https://developers.cloudflare.com/workers/)
that serves a hub page linking the free, open-source GEO tools and their repos:

- 🤖 **AI Crawl Check** — `ai-crawl-check.geosuite.workers.dev` (repo `ai-crawler-bots`)
- 📄 **llms.txt Generator** — `llmstxt-generator.geosuite.workers.dev` (repo `llms-txt-generator`)
- 🔖 **Schema Templates** — `schema-templates.geosuite.workers.dev` (repo `schema-templates`)
- 🗺️ **Sitemap Builder** — `sitemap-builder.geosuite.workers.dev` (repo `sitemap-builder`)

It's a single static page — no logic, no deps.

## Deploy

```bash
npx wrangler deploy
```

⚠️ Deploy to your **personal / GeoSuite** Cloudflare account, not the work one
(`wrangler whoami` to check). Publishes to
`https://geo-toolkit.<your-subdomain>.workers.dev`.

This folder isn't a git repo of its own — it's a loose tool under `open-source/`.
Update the tool URLs in `page.js` if a Worker's name/subdomain changes. To put it
on a memorable custom domain (e.g. `tools.trygeosuite.it`), add a `routes` block
to `wrangler.toml` (the zone must be on the same account).
