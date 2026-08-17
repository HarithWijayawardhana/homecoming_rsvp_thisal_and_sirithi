/* =============================================================
   POST /api/rsvp   ->  { "ok": true }

   Receives the payload built in js/main.js (see the sendBtn click
   handler). It arrives as text/plain, so Vercel hands over an
   unparsed string; readBody() copes with that, with an already
   parsed object, and with a raw stream.

   Nothing the browser says about itself is trusted: the party is
   looked up by id, the names must match that party, and seats and
   invited are recounted here from the answers.
   ============================================================= */

import { db } from './_db.js';
import { norm } from './_guests.js';

var LIMIT = { contact: 200, song: 200, notes: 1000, message: 2000, name: 200 };

/* One invitation should not be able to fill the table. Generous enough
   that a family changing its mind repeatedly is never turned away. */
var MAX_PER_PARTY = 20;

async function readBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  var chunks = [];
  for await (var chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function clip(v, n) {
  return String(v == null ? '' : v).trim().slice(0, n);
}

function when(v) {
  var t = Date.parse(String(v || ''));
  return isNaN(t) ? null : new Date(t).toISOString();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Use POST' });
  }

  var data;
  try {
    data = JSON.parse(await readBody(req));
  } catch (err) {
    return res.status(400).json({ ok: false, error: 'Could not read that response' });
  }

  var partyId = clip(data && data.partyId, 100);
  var answers = data && Array.isArray(data.responses) ? data.responses : [];

  if (!partyId || !answers.length) {
    return res.status(400).json({ ok: false, error: 'Missing invitation' });
  }

  var sql = db();

  try {
    var rows = await sql`select id, party, people from parties where id = ${partyId}`;
    if (!rows.length) {
      return res.status(400).json({ ok: false, error: 'We do not have that invitation' });
    }
    var party = rows[0];
    var people = party.people || [];

    // the answers must cover exactly the people on that envelope
    var want = people.map(norm).slice().sort().join('|');
    var got = answers.map(function (a) { return norm(a && a.name); }).slice().sort().join('|');
    if (answers.length !== people.length || want !== got) {
      return res.status(400).json({ ok: false, error: 'Those names do not match the invitation' });
    }

    var clean = answers.every(function (a) {
      return a && (a.attending === 'yes' || a.attending === 'no');
    });
    if (!clean) {
      return res.status(400).json({ ok: false, error: 'Every name needs a yes or a no' });
    }

    var seen = await sql`select count(*)::int as n from responses where party_id = ${partyId}`;
    if (seen[0].n >= MAX_PER_PARTY) {
      return res.status(429).json({ ok: false, error: 'That invitation has already been answered' });
    }

    // written in the order the names appear on the envelope, not the order they arrived
    var order = {};
    answers.forEach(function (a) { order[norm(a.name)] = a.attending; });
    var names = people.map(function (n) { return clip(n, LIMIT.name); });
    var attending = people.map(function (n) { return order[norm(n)]; });
    var seats = attending.filter(function (a) { return a === 'yes'; }).length;

    /* One statement, so the response and its people land together or
       not at all. The Neon HTTP driver has no multi-statement
       transaction, and a data-modifying CTE does not need one. */
    await sql`
      with r as (
        insert into responses
          (party_id, party, seats, invited, contact, song, notes, message, sent_at)
        values (
          ${partyId},
          ${party.party},
          ${seats},
          ${people.length},
          ${clip(data.contact, LIMIT.contact)},
          ${clip(data.song, LIMIT.song)},
          ${clip(data.notes, LIMIT.notes)},
          ${clip(data.message, LIMIT.message)},
          ${when(data.sentAt)}
        )
        returning id
      )
      insert into response_people (response_id, name, attending)
      select r.id, t.name, t.attending = 'yes'
      from r, unnest(${names}::text[], ${attending}::text[]) as t(name, attending)
    `;

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('rsvp failed', err);
    return res.status(500).json({ ok: false, error: 'Could not save that response' });
  }
}
