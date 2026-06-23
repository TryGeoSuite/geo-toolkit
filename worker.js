// "GeoSuite Open" landing — a static hub linking the free GEO tools + repos.
// Pure static page, no logic, no deps.

import { PAGE } from './page.js';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return new Response(PAGE, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' },
      });
    }
    return new Response('Not found', { status: 404 });
  },
};
