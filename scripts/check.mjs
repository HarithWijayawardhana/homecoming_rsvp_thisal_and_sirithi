/* =============================================================
   What is in the database right now.

     npm run db:check

   A quick read for the terminal — the full export is
   /api/responses?key=…
   ============================================================= */

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run: vercel env pull .env.local');
  process.exit(1);
}

var sql = neon(process.env.DATABASE_URL);

var counts = await sql`
  select
    (select count(*) from parties)         as parties,
    (select count(*) from responses)       as responses,
    (select count(*) from response_people) as people
`;
var c = counts[0];
console.log(c.parties + ' invitations, ' + c.responses + ' responses, ' + c.people + ' answers.\n');

var latest = await sql`
  select r.received_at, r.party, r.seats, r.invited, r.contact
  from responses r
  order by r.received_at desc
  limit 10
`;

if (!latest.length) {
  console.log('No responses yet.');
} else {
  console.log('Most recent:');
  latest.forEach(function (r) {
    console.log('  ' + new Date(r.received_at).toISOString().slice(0, 16).replace('T', ' ') +
      '  ' + r.party + ' — ' + r.seats + ' of ' + r.invited +
      (r.contact ? '  ' + r.contact : ''));
  });

  var tally = await sql`
    select
      count(*) filter (where attending)     as coming,
      count(*) filter (where not attending) as not_coming
    from response_people p
    where p.response_id in (
      select max(id) from responses group by party_id
    )
  `;
  console.log('\nCounting only each party\'s latest answer: ' +
    tally[0].coming + ' coming, ' + tally[0].not_coming + ' not.');
}
