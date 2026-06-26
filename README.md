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

The hub page itself — a small zero-dependency [Cloudflare Worker](https://developers.cloudflare.com/workers/)
that deploys to **tools.trygeosuite.it**. It does a bit more than serve static HTML:

- **Bilingual (en/it):** `/` is content-negotiated on `Accept-Language`; `/en` and
  `/it` are explicit, with an EN·IT switch, `hreflang`/`canonical` and `x-default → /`.
- **Live social proof:** one header figure shows the four tools' combined npm
  downloads (all-time + last-month), fetched server-side with a last-good Cache
  fallback so a rate-limit blip never blanks it.
- **Dogfoods GEO:** serves `/robots.txt` (welcomes AI crawlers → scores 100 on our
  own AI Crawl Check), `/llms.txt`, `/sitemap.xml`, and JSON-LD (Organization +
  an ItemList of the four `SoftwareApplication`s) in the page head.
- **Shareable:** Open Graph + Twitter card meta with a bundled 1200×630 `/og.png`
  (wrangler `Data` rule), plus an inline `/favicon.svg`.

```bash
npx wrangler deploy   # to the GeoSuite Cloudflare account
```

Pushes to `main` auto-deploy via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
(needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets). If a tool's
worker name/subdomain changes, update the links in `page.js`.

## License

[MIT](./LICENSE) — by **[Matteo Perino](https://github.com/matte97p)**, maintained
under [GeoSuite](https://trygeosuite.it).

---

## Built by GeoSuite

This is part of the open-source toolkit behind **[GeoSuite](https://trygeosuite.it)** — the platform that measures and improves how AI engines (ChatGPT, Gemini, Claude, Perplexity) cite your brand. [Explore the platform →](https://trygeosuite.it)
