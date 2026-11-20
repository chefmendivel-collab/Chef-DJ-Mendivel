// Paul HTTP router — Wix /_functions/ endpoints live in http-functions.js only.
// A .web.js file alone does NOT expose /_functions/ URLs: Wix looks for
// backend/http-functions.js and errors "Cannot find module 'backend/http-functions.js'".
// This file routes /_functions/paul/<endpoint> to the logic in backend/paul.web.js.
// Endpoints: GET status, GET availability?date=YYYY-MM-DD, GET info, POST chat,
// POST voice, GET avatar, GET deployments. No secrets here — paul.web.js reads them by name.
import { response } from 'wix-http-functions';
import { get_status, get_availability, get_info, post_chat, post_voice, get_avatar, get_deployments } from 'backend/paul.web.js';

const HANDLERS = {
  status: { get: get_status },
  availability: { get: get_availability },
  info: { get: get_info },
  chat: { post: post_chat },
  voice: { post: post_voice },
  avatar: { get: get_avatar },
  deployments: { get: get_deployments }
};

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };

const json = (status, body) => response({ status, headers: CORS, body: JSON.stringify(body) });

async function run(request) {
  if ((request.method || 'get').toLowerCase() === 'options') return response({ status: 204, headers: CORS, body: '' });
  const seg = (request.path && request.path[0]) || '';
  const method = (request.method || 'get').toLowerCase();
  const h = HANDLERS[seg] && HANDLERS[seg][method];
  if (!h) return json(404, { error: 'Unknown Paul endpoint: ' + seg });
  const req = {
    query: request.query || {},
    body: { json: async () => { try { return await request.body.json(); } catch (e) { return {}; } } }
  };
  try {
    const out = await h(req);
    return json(out.status || 200, out.body ?? {});
  } catch (e) {
    return json(500, { error: 'Paul failed.' });
  }
}

export function use_paul(request) { return run(request); }
