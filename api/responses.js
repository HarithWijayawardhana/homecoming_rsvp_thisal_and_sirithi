/* =============================================================
   GET /api/responses?key=…            -> CSV, opens in Excel or Sheets
   GET /api/responses?key=…&format=json -> the same data, nested

   One line per person, the same shape the Sheets backend wrote, plus
   a Superseded column: every submission is kept, so if a party
   answers twice you can see both and the older one is marked rather
   than hidden.

   Guarded by ADMIN_KEY. Never link to this from the page.
   ============================================================= */

import { timingSafeEqual } from 'node:crypto';
import { db } from './_db.js';

var COLUMNS = [
  'Received', 'Party', 'Name', 'Attending', 'Seats coming', 'Invited',
  'Contact', 'Song', 'Notes', 'Message', 'Superseded'
];

function keyMatches(given, expected) {
  var a = Buffer.from(String(given || ''), 'utf8');
  var b = Buffer.from(String(expected || ''), 'utf8');
  if (!a.length || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function csvCell(v) {
  var s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Use GET' });
  }

  var expected = process.env.ADMIN_KEY;
  if (!expected) {
    console.error('ADMIN_KEY is not set');
    return res.status(500).json({ ok: false, error: 'Export is not configured' });
  }
  if (!keyMatches(req.query && req.query.key, expected)) {
    return res.status(401).json({ ok: false, error: 'Not authorised' });
  }

  try {
    var rows = await db()`
      select
        r.id,
        r.received_at,
        r.party,
        r.seats,
        r.invited,
        r.contact,
        r.song,
        r.notes,
        r.message,
        p.name,
        p.attending,
        r.id <> max(r.id) over (partition by r.party_id) as superseded
      from responses r
      join response_people p on p.response_id = r.id
      order by r.received_at desc, r.id desc, p.id
    `;

    if ((req.query && req.query.format) === 'json') {
      return res.status(200).json({ ok: true, count: rows.length, rows: rows });
    }

    var lines = [COLUMNS.join(',')];
    rows.forEach(function (r) {
      lines.push([
        r.received_at instanceof Date ? r.received_at.toISOString() : r.received_at,
        r.party,
        r.name,
        r.attending ? 'Attending' : 'Cannot attend',
        r.seats,
        r.invited,
        r.contact,
        r.song,
        r.notes,
        r.message,
        r.superseded ? 'superseded' : ''
      ].map(csvCell).join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rsvp-responses.csv"');
    // BOM so Excel opens the accented names correctly
    return res.status(200).send('﻿' + lines.join('\r\n') + '\r\n');

  } catch (err) {
    console.error('export failed', err);
    return res.status(500).json({ ok: false, error: 'Could not read the responses' });
  }
}
