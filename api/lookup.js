/* =============================================================
   GET /api/lookup?q=nimal
   ->  { "parties": [ { id, party, people, answers?, answeredAt? } ] }

   The other half of lookupParty() in js/main.js. Aliases are used
   for matching but never returned — a guest should not be able to
   read the nicknames we hold for anyone.

   The whole party list is pulled and matched in JS rather than in
   SQL. That is deliberate: it is the only way to be sure the server
   matches names exactly as the browser would. A few hundred rows is
   nothing, and the list is cached between warm invocations.

   `answers` is the party's most recent response, one 'yes' / 'no' /
   null per name in `people`, so a guest who comes back finds the
   roster already filled in rather than blank. It is deliberately
   *not* cached with the party list: a guest who answers and searches
   again a moment later must see what they just sent.
   ============================================================= */

import { db } from './_db.js';
import { matchParties, norm } from './_guests.js';

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

/* The latest response for each of the given parties, as
   { partyId: { at, byName: { normalised name: 'yes' | 'no' } } }.
   Every submission is kept, so "latest" is the highest id. */
async function latestAnswers(ids) {
  if (!ids.length) return {};

  var rows = await db()`
    with latest as (
      select distinct on (party_id) party_id, id, received_at
      from responses
      where party_id = any(${ids}::text[])
      order by party_id, id desc
    )
    select l.party_id, l.received_at, p.name, p.attending
    from latest l
    join response_people p on p.response_id = l.id
  `;

  var out = {};
  rows.forEach(function (r) {
    var e = out[r.party_id] || (out[r.party_id] = { at: r.received_at, byName: {} });
    e.byName[norm(r.name)] = r.attending ? 'yes' : 'no';
  });
  return out;
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
    var prev = await latestAnswers(found.map(function (p) { return p.id; }));

    return res.status(200).json({
      parties: found.map(function (p) {
        var out = { id: p.id, party: p.party, people: p.people };
        var said = prev[p.id];
        if (said) {
          // aligned with people, so the browser never has to match names again
          out.answers = (p.people || []).map(function (n) { return said.byName[norm(n)] || null; });
          out.answeredAt = new Date(said.at).toISOString();
        }
        return out;
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
