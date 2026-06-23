# GeoSuite Open — free GEO tools

Free, open-source tools for **Generative Engine Optimization (GEO)** — making
your site legible to ChatGPT, Gemini, Claude & Perplexity. Zero dependencies,
no signup. Use them in your terminal, or right in the browser.

### ▶ [tools.trygeosuite.it](https://tools.trygeosuite.it) — the hub

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## What's inside

| Tool | What it does | Try it | Code |
| --- | --- | --- | --- |
| 🤖 **AI Crawl Check** | See which AI crawlers (GPTBot, ClaudeBot, PerplexityBot…) your `robots.txt` allows or blocks, with an AI-visibility score. Plus a public bot-list API. | [open](https://ai-crawl-check.geosuite.workers.dev) | [ai-crawler-bots](https://github.com/TryGeoSuite/ai-crawler-bots) |
| 📄 **llms.txt Generator** | Turn any site's `sitemap.xml` into an `llms.txt` — the index that tells AI models which pages matter. | [open](https://llmstxt-generator.geosuite.workers.dev) | [llms-txt-generator](https://github.com/TryGeoSuite/llms-txt-generator) |
| 🔖 **Schema Templates** | Copy-paste schema.org JSON-LD templates (Organization, Product, FAQPage…) and validate your own. | [open](https://schema-templates.geosuite.workers.dev) | [schema-templates](https://github.com/TryGeoSuite/schema-templates) |
| 🗺️ **Sitemap Builder** | Crawl a site and build a `sitemap.xml` — quick in the browser, or a full crawl from the CLI. | [open](https://sitemap-builder.geosuite.workers.dev) | [sitemap-builder](https://github.com/TryGeoSuite/sitemap-builder) |

## Run from your terminal

Every tool is also a zero-dependency CLI on npm:

```bash
npx @geosuite/ai-crawler-bots robots https://example.com
npx @geosuite/llms-txt-generator https://example.com/sitemap.xml
npx @geosuite/schema-templates show Organization
npx @geosuite/sitemap-builder https://example.com
```

## This repo

The hub page itself — a tiny static [Cloudflare Worker](https://developers.cloudflare.com/workers/),
no logic, no deps. It deploys to **tools.trygeosuite.it**.

```bash
npx wrangler deploy   # to the GeoSuite Cloudflare account
```

Pushes to `main` auto-deploy via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
(needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets). If a tool's
worker name/subdomain changes, update the links in `page.js`.

## License

[MIT](./LICENSE) — by **[Matteo Perino](https://github.com/matte97p)**, maintained
under [GeoSuite](https://trygeosuite.it).
