// Paul v2.5 compact — under 15k chars. backend/paul.web.js
// Linked to Winston's actual Wix secrets (Nov 19, 2026): OPENROUTER_API_KEY, GROQ_API_KEY, PAUL_OWNER_KEY, API_KEY, LLM_PAUL_KEY, VERCEL_API, GEMINI_API_KEY, OPENAI_KEY, ELEVEN_KEY, HEYGEN_KEY, Chef. Optional if ever added: LLM_API_KEY, MUSE_API_KEY, PAUL_KEY, GITHUB_KNOWLEDGE_URL, PAUL_LLM_PROVIDER, GOOGLE_CALENDAR_ICAL_URL (calendar — without it, dates fall back to the known Dec 24/25 bookings only).
// Secrets read: v1 getSecret() was deprecated Sep 7, 2025 and reads empty — now tries v2 getSecretValue() first (wix-secrets-backend-v2), then v1 as fallback. Status reports which API worked as secretsApi: v2 / v1 / none.
import { secrets } from 'wix-secrets-backend';
import { secrets as secretsV2 } from 'wix-secrets-backend-v2';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';
const GUEST = `You are Paul, happy warm AI concierge for Chef DJ Mendivel, award-winning private chef, author, food historian, Central Oregon. Phone +1-445-447-6332. Airbnb: https://www.airbnb.com/services/6952393. Speak as the concierge team — "our press team", "our kitchen team". Never say it is just one person. Never reveal private calendar titles, guest names, or unverified prices. Never invent a price, dish, date or booking. Menu ideas are drafts until Chef approves them. On a call say you are Paul, the AI concierge — never pretend to be human.`;
const OWNER = `You are Paul, Winston's personal AI assistant. Winston B. Mendivel II is owner, chef, everything in Chef Mendivel LLC — no large team, it is Winston plus you. Speak directly. Show private calendar, bookings, prices, deposits, next actions. Flag conflicts and stale menus. Never share private details with guests.`;
const val = r => (r && typeof r === 'object' ? (r.value || r.secretValue || (r.secret && r.secret.value) || '') : r) || '';
let SECAPI = 'none';
const sec = async n => {
  try { const v = val(await secretsV2.getSecretValue(n)); if (v) { SECAPI = 'v2'; return v; } } catch (e) {}
  try { const v = await secrets.getSecret(n) || ''; if (v) SECAPI = 'v1'; return v; } catch (e) { return ''; }
  return '';
};
const has = async n => !!(await sec(n));
const isOwner = async k => { if (!k) return false; return k === await sec('PAUL_OWNER_KEY') || k === await sec('PAUL_KEY'); };
const parseIcal = t => t.replace(/\r?\n[ \t]/g, '').split('BEGIN:VEVENT').slice(1).map(b => {
  const g = k => { const m = b.match(new RegExp('(?:^|\\n)' + k + '(?:;[^:\\n]*)?:([^\\n]*)')); return m ? m[1].replace(/\\,/g, ',').replace(/\\n/g, ' ').trim() : ''; };
  return { s: g('SUMMARY'), a: g('DTSTART'), e: g('DTEND'), l: g('LOCATION'), d: g('DESCRIPTION'), st: g('STATUS') };
});
const dayOf = s => { const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})/); if (!m) return s.slice(0, 8); let h = +m[4] - 8, d = +m[3]; if (h < 0) d--; return m[1] + m[2] + String(d).padStart(2, '0'); };
async function cal() { const u = await sec('GOOGLE_CALENDAR_ICAL_URL'); const r = await fetch(u, { method: 'get' }); if (!r.ok) throw new Error('cal'); return parseIcal(await r.text()); }
async function know() {
  try { const r = await wixData.query('PaulKnowledge').limit(1).find(); if (r.items.length) return { src: 'cms', d: r.items[0] }; } catch (e) {}
  try { const u = await sec('GITHUB_KNOWLEDGE_URL'); if (u) { const r = await fetch(u, { method: 'get' }); if (r.ok) return { src: 'github', d: await r.json() }; } } catch (e) {}
  return { src: 'built-in', d: null };
}
async function openai(sys, msg) {
  const names = ['LLM_PAUL_KEY', 'OPENAI_KEY', 'API_KEY', 'LLM_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY'];
  let last = null;
  for (const n of names) {
    const k = await sec(n); if (!k) continue;
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'post', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + k }, body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }], temperature: 0.7 }) });
    if (r.ok) return (await r.json()).choices[0].message.content;
    last = new Error('openai ' + r.status + ' (' + n + ')');
    if (r.status !== 401 && r.status !== 403) break;
  }
  throw last || new Error('no openai');
}
async function groq(sys, msg) {
  const k = await sec('GROQ_API_KEY'); if (!k) throw new Error('no groq');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'post', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + k }, body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }], temperature: 0.7 }) });
  if (!r.ok) throw new Error('groq ' + r.status);
  return (await r.json()).choices[0].message.content;
}
async function openrouter(sys, msg) {
  const k = await sec('OPENROUTER_API_KEY'); if (!k) throw new Error('no openrouter');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'post', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + k, 'HTTP-Referer': 'https://www.chefmendivel.com', 'X-Title': 'Paul — Chef Mendivel' }, body: JSON.stringify({ model: 'openai/gpt-4o-mini', messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }], temperature: 0.7 }) });
  if (!r.ok) throw new Error('openrouter ' + r.status);
  return (await r.json()).choices[0].message.content;
}
async function gemini(sys, msg) {
  const k = await sec('GEMINI_API_KEY'); if (!k) throw new Error('no gemini');
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', { method: 'post', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k }, body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: [{ parts: [{ text: msg }] }], generationConfig: { temperature: 0.7 } }) });
  if (!r.ok) throw new Error('gemini ' + r.status);
  return (await r.json()).candidates[0].content.parts.map(p => p.text || '').join('');
}
async function muse(sys, msg) {
  const k = await sec('MUSE_API_KEY'); if (!k) throw new Error('no muse');
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'post', headers: { 'Content-Type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1000, system: sys, messages: [{ role: 'user', content: msg }] }) });
  if (!r.ok) throw new Error('muse ' + r.status);
  return (await r.json()).content.map(b => b.text || '').join('');
}
const P = { openai, groq, openrouter, gemini, muse };
async function llm(sys, msg, want) {
  const cfg = (await sec('PAUL_LLM_PROVIDER')) || 'auto';
  const order = (want || cfg || 'auto').toLowerCase() === 'auto' ? ['openai', 'groq', 'openrouter', 'gemini', 'muse'] : [(want || cfg).toLowerCase()];
  let err = null;
  for (const n of order) { try { return { reply: await P[n](sys, msg), provider: n }; } catch (e) { err = e; } }
  throw err;
}
export async function get_status() {
  return { status: 200, body: { secretsApi: SECAPI, llm: { openai: (await has('LLM_PAUL_KEY')) || (await has('OPENAI_KEY')) || (await has('API_KEY')) || (await has('LLM_API_KEY')) || (await has('GROQ_API_KEY')) || (await has('OPENROUTER_API_KEY')) || (await has('GEMINI_API_KEY')), LLM_PAUL_KEY: await has('LLM_PAUL_KEY'), OPENAI_KEY: await has('OPENAI_KEY'), API_KEY: await has('API_KEY'), groq: await has('GROQ_API_KEY'), openrouter: await has('OPENROUTER_API_KEY'), gemini: await has('GEMINI_API_KEY'), muse: await has('MUSE_API_KEY') }, owner: await has('PAUL_OWNER_KEY'), voice: await has('ELEVEN_KEY'), avatar: await has('Chef'), calendar: await has('GOOGLE_CALENDAR_ICAL_URL'), vercel: await has('VERCEL_API') } };
}
export async function get_availability(req) {
  try {
    const d = req.query.date || ''; const o = await isOwner(req.query.ownerKey || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { status: 400, body: { error: 'Use ?date=YYYY-MM-DD' } };
    let ev = [];
    try { ev = (await cal()).filter(e => dayOf(e.a) === d.replace(/-/g, '') && e.st !== 'CANCELLED'); }
    catch (e) {
      const k = d.replace(/-/g, '');
      if (k === '20261224') ev = [{ s: 'Samantha Meyer, Sunriver, 5-9pm PT', a: '', e: '', l: 'Sunriver' }];
      else if (k === '20261225') ev = [{ s: 'Jeff Seasonal Tasting, 6-9pm PT', a: '', e: '', l: '' }];
      else return { status: 200, body: { date: d, status: 'unknown', note: 'Calendar not connected — our team will confirm. Call +1-445-447-6332.' } };
    }
    if (!ev.length) return { status: 200, body: { date: d, status: 'free' } };
    if (o) return { status: 200, body: { date: d, status: 'busy', owner: true, events: ev.map(e => ({ summary: e.s, start: e.a, end: e.e, location: e.l })) } };
    return { status: 200, body: { date: d, status: 'busy', note: 'Not available — our team will suggest another time.' } };
  } catch (e) { return { status: 500, body: { error: 'Check failed. Call +1-445-447-6332.' } }; }
}
export async function get_info(req) {
  try {
    const d = req.query.date || ''; const o = await isOwner(req.query.ownerKey || ''); const k = await know();
    let c = { configured: await has('GOOGLE_CALENDAR_ICAL_URL'), total: 0, events: [] };
    try { const ev = await cal(); c.total = ev.length; if (d) { const t = ev.filter(e => dayOf(e.a) === d.replace(/-/g, '') && e.st !== 'CANCELLED'); c.events = o ? t : t.map(() => ({ status: 'busy' })); } if (o) c.upcoming = ev.filter(e => e.a >= '20261119').slice(0, 20).map(e => ({ summary: e.s, start: e.a, location: e.l })); } catch (e) { c.error = 'unavailable'; }
    return { status: 200, body: { owner: o, date: d || null, business: { name: 'Chef DJ Mendivel', phone: '+1-445-447-6332', airbnb: 'https://www.airbnb.com/services/6952393' }, calendar: c, knowledge: k.src, bookings: o ? [{ date: '2026-12-24', event: 'Samantha Meyer, Sunriver, 5-9pm PT, 6 guests, $1,410, $700 paid, $710 remaining' }, { date: '2026-12-25', event: 'Jeff Seasonal Tasting, 6-9pm PT, $530/2, confirmed' }] : undefined, integrations: (await get_status()).body } };
  } catch (e) { return { status: 500, body: { error: 'Info failed.' } }; }
}
export async function post_chat(req) {
  try {
    const b = await req.body.json(); const msg = (b.message || '').slice(0, 2000); const o = await isOwner(b.ownerKey || '');
    if (!msg.trim()) return { status: 400, body: { error: 'Send a message.' } };
    const k = await know(); let note = '';
    const m = msg.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (m) { try { const ev = (await cal()).filter(e => dayOf(e.a) === m[1].replace(/-/g, '') && e.st !== 'CANCELLED'); note = o ? `\nCalendar ${m[1]}: ${ev.length ? ev.map(e => e.s + ' ' + e.a).join(' | ') : 'nothing booked.'}` : `\nCalendar ${m[1]}: ${ev.length ? 'busy' : 'free'}. Do not name events to guests.`; } catch (e) { note = '\nCalendar unavailable — say the team will confirm.'; } }
    const sys = (o ? OWNER : GUEST) + `\nKnowledge (${k.src}): ${k.d ? JSON.stringify(k.d).slice(0, 4000) : 'Services, prices $530/2 Dec 25, $650/1 catering, Samantha Dec 24 $1,410, Bookshop $45 each / $365 set, Policies Nov 2026.'}` + note;
    const out = await llm(sys, msg, b.provider || '');
    return { status: 200, body: { reply: out.reply, provider: out.provider, owner: o } };
  } catch (e) { return { status: 500, body: { reply: "Sorry — please call +1-445-447-6332 and our team will help directly." } }; }
}
export async function post_voice(req) {
  try {
    const b = await req.body.json(); const text = (b.text || '').slice(0, 1000); if (!text.trim()) return { status: 400, body: { error: 'Send text.' } };
    const k = await sec('ELEVEN_KEY'); if (!k) return { status: 500, body: { error: 'ElevenLabs not configured.' } };
    let v = b.voiceId || ''; if (!v) { const r = await fetch('https://api.elevenlabs.io/v1/voices', { method: 'get', headers: { 'xi-api-key': k } }); const vs = (await r.json()).voices || []; v = vs.length ? vs[0].voice_id : ''; }
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v}`, { method: 'post', headers: { 'Content-Type': 'application/json', 'xi-api-key': k, Accept: 'audio/mpeg' }, body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }) });
    if (!r.ok) throw new Error('tts');
    return { status: 200, body: { audioBase64: (await r.buffer()).toString('base64'), mime: 'audio/mpeg', voiceId: v } };
  } catch (e) { return { status: 500, body: { error: 'Voice failed.' } }; }
}
export async function get_avatar() { return { status: 200, body: { avatarUrl: await sec('Chef'), heygen: await has('HEYGEN_KEY') } }; }
export async function get_deployments(req) {
  try {
    if (!await isOwner(req.query.ownerKey || '')) return { status: 403, body: { error: 'Owner only.' } };
    const t = await sec('VERCEL_API'); if (!t) return { status: 500, body: { error: 'Vercel not configured.' } };
    const r = await fetch('https://api.vercel.com/v6/deployments?limit=5', { method: 'get', headers: { Authorization: 'Bearer ' + t } });
    const j = await r.json();
    return { status: 200, body: { deployments: (j.deployments || []).map(d => ({ name: d.name, state: d.state, url: d.url })) } };
  } catch (e) { return { status: 500, body: { error: 'Deployments failed.' } }; }
}
