// Landing page for the GeoSuite Open GEO toolkit — a hub linking the free
// hosted tools and their open-source repos. Plain template string, all inline.

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GeoSuite Open — free GEO tools</title>
<meta name="description" content="Free, open-source tools for Generative Engine Optimization (GEO): audit AI crawlers, generate llms.txt, build schema.org JSON-LD, and create sitemaps.">
<style>
  :root {
    --bg: #0b0f17; --panel: #131a26; --line: #243042; --text: #e7edf5;
    --muted: #8b9bb4; --accent: #5b8def;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 900px; margin: 0 auto; padding: 56px 20px 80px; }
  header { text-align: center; margin-bottom: 36px; }
  header h1 { font-size: 2rem; margin: 0 0 10px; letter-spacing: -0.02em; }
  header p { color: var(--muted); margin: 0 auto; max-width: 560px; }
  header .cta { display: inline-block; margin-top: 18px; background: var(--accent); color: #fff; font-weight: 600; padding: 11px 20px; border-radius: 10px; text-decoration: none; }
  header .cta:hover { opacity: .9; }
  header .stats { margin: 18px auto 0; color: var(--muted); font-size: .9rem; }
  header .stats strong { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  .tool { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 20px; display: flex; flex-direction: column; }
  .tool h2 { margin: 0 0 6px; font-size: 1.15rem; }
  .tool .emoji { font-size: 1.5rem; }
  .tool p { color: var(--muted); margin: 0 0 14px; font-size: .92rem; flex: 1; }
  .tool .links { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .tool a.open { background: var(--accent); color: #fff; font-weight: 600; font-size: .9rem; padding: 9px 15px; border-radius: 9px; text-decoration: none; }
  .tool a.open:hover { opacity: .9; }
  .tool a.ghost { border: 1px solid var(--line); color: var(--text); font-size: .9rem; padding: 9px 13px; border-radius: 9px; text-decoration: none; }
  .tool a.ghost:hover { border-color: var(--accent); color: var(--accent); }
  .tool code { display: block; margin-top: 12px; color: var(--muted); font-size: .8rem; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  footer { margin-top: 40px; color: var(--muted); font-size: .88rem; text-align: center; }
  footer a { color: var(--accent); text-decoration: none; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>GeoSuite Open</h1>
    <p>Free, open-source tools for <strong style="color:var(--text)">Generative Engine Optimization</strong> — making your site legible to ChatGPT, Gemini, Claude &amp; Perplexity. Zero dependencies, run in your terminal or right here.</p>
    <a class="cta" href="https://trygeosuite.it" target="_blank" rel="noopener">Explore GeoSuite →</a>
    {{STATS}}
  </header>

  <div class="grid">
    <div class="tool">
      <h2><span class="emoji">🤖</span> AI Crawl Check</h2>
      <p>See which AI crawlers (GPTBot, ClaudeBot, PerplexityBot…) your <code style="display:inline">robots.txt</code> allows or blocks — with an AI-visibility score. Plus a public bot-list API.</p>
      <div class="links">
        <a class="open" href="https://ai-crawl-check.geosuite.workers.dev" target="_blank" rel="noopener">Open tool →</a>
        <a class="ghost" href="https://github.com/TryGeoSuite/ai-crawler-bots" target="_blank" rel="noopener">GitHub</a>
      </div>
      <code>npx @geosuite/ai-crawler-bots robots &lt;url&gt;</code>
    </div>

    <div class="tool">
      <h2><span class="emoji">📄</span> llms.txt Generator</h2>
      <p>Turn any site's <code style="display:inline">sitemap.xml</code> into an <code style="display:inline">llms.txt</code> — the curated index that tells AI models which pages matter.</p>
      <div class="links">
        <a class="open" href="https://llmstxt-generator.geosuite.workers.dev" target="_blank" rel="noopener">Open tool →</a>
        <a class="ghost" href="https://github.com/TryGeoSuite/llms-txt-generator" target="_blank" rel="noopener">GitHub</a>
      </div>
      <code>npx @geosuite/llms-txt-generator &lt;sitemap&gt;</code>
    </div>

    <div class="tool">
      <h2><span class="emoji">🔖</span> Schema Templates</h2>
      <p>Copy-paste schema.org JSON-LD templates (Organization, Product, FAQPage, Article…) and validate your own structured data.</p>
      <div class="links">
        <a class="open" href="https://schema-templates.geosuite.workers.dev" target="_blank" rel="noopener">Open tool →</a>
        <a class="ghost" href="https://github.com/TryGeoSuite/schema-templates" target="_blank" rel="noopener">GitHub</a>
      </div>
      <code>npx @geosuite/schema-templates show Organization</code>
    </div>

    <div class="tool">
      <h2><span class="emoji">🗺️</span> Sitemap Builder</h2>
      <p>Crawl a site and build a <code style="display:inline">sitemap.xml</code> — a quick capped version here, or a full crawl from the CLI.</p>
      <div class="links">
        <a class="open" href="https://sitemap-builder.geosuite.workers.dev" target="_blank" rel="noopener">Open tool →</a>
        <a class="ghost" href="https://github.com/TryGeoSuite/sitemap-builder" target="_blank" rel="noopener">GitHub</a>
      </div>
      <code>npx @geosuite/sitemap-builder &lt;url&gt;</code>
    </div>
  </div>

  <footer>
    Open source (MIT) by <a href="https://github.com/matte97p">Matteo Perino</a> · maintained under <a href="https://trygeosuite.it">GeoSuite</a> ·
    <a href="https://github.com/TryGeoSuite">github.com/TryGeoSuite</a>
  </footer>
</div>
</body>
</html>`;
