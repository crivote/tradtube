import tunes from './tunes-meta.json' with { type: 'json' };

const SITE_TITLE = 'TradTube — Traditional Irish tunes on video';
const SITE_DESC = 'Find and watch traditional Irish tunes on YouTube with precise timestamps. Browse jigs, reels, hornpipes and more from TheSession.org catalog.';
const SITE_URL = 'https://tradtube.netlify.app';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(request, context) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/tune\/(\d+)\/?$/);

  if (!match) {
    return context.next();
  }

  const tuneId = match[1];
  const meta = tunes[tuneId];

  const response = await context.next();

  if (!meta) {
    return response;
  }

  const tuneTitle = `${esc(meta.n)} — TradTube`;
  const tuneDesc = esc(`Traditional Irish ${meta.t}. Watch videos with precise timestamps on TradTube.`);
  const tuneUrl = esc(`${SITE_URL}/tune/${tuneId}`);

  const ogTags = [
    `<title>${tuneTitle}</title>`,
    `<meta property="og:title" content="${tuneTitle}" />`,
    `<meta property="og:description" content="${tuneDesc}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${tuneUrl}" />`,
    `<meta property="og:site_name" content="TradTube" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${tuneTitle}" />`,
    `<meta name="twitter:description" content="${tuneDesc}" />`,
  ].join('\n');

  const html = await response.text();

  const newHtml = html
    .replace(/<title>.*?<\/title>/, `<title>${tuneTitle}</title>`)
    .replace('</head>', `${ogTags}\n</head>`);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');

  return new Response(newHtml, {
    status: response.status,
    headers,
  });
}
