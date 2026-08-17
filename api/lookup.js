/* =============================================================
   GET /api/lookup?q=nimal
   ->  { "parties": [ { id, party, people } ] }

   The other half of lookupParty() in js/main.js. Aliases are used
   for matching but never returned — a guest should not be able to
   read the nicknames we hold for anyone.

   The whole party list is pulled and matched in JS rather than in
   SQL. That is deliberate: it is the only way to be sure the server
   matches names exactly as the browser would. A few hundred rows is
   nothing, and the list is cached between warm invocations.
   ============================================================= */

import { db } from './_db.js';
import { matchParties } from './_guests.js';

var CACHE_MS = 60000;
var cache = null;
var cachedAt = 0;

async function allParties() {
  var now = Date.now();
  if (cache && now - cachedAt < CACHE_MS) return cache;
  var rows = await db()`select id, party, people, aliases from parties`;
  cache = rows;
  cachedAt = now;
  return rows;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ parties: [], error: 'Use GET' });
  }

  var q = (req.query && req.query.q) || '';
  if (!q) return res.status(200).json({ parties: [] });

  try {
    var found = matchParties(await allParties(), q);
    return res.status(200).json({
      parties: found.map(function (p) {
        return { id: p.id, party: p.party, people: p.people };
      })
    });
  } catch (err) {
    console.error('lookup failed', err);
    // js/main.js turns a non-200 into "We could not find that name",
    // so answer 500 rather than an empty list — an empty list would
    // read to the guest as "you are not invited".
    return res.status(500).json({ parties: [], error: 'Lookup failed' });
  }
}
