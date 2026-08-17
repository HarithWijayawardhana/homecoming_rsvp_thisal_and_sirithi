/* =============================================================
   Loads js/guests.js into the parties table.

     npm run db:seed

   js/guests.js stays the one place the guest list is written by hand,
   exactly as before — it just no longer ships to the browser. Edit
   that file, run this, and the lookup follows.

   Upserts by id, so running it again after an edit updates rather
   than duplicates. It never deletes: if an id is in the table but no
   longer in the file it is reported, and you decide.
   ============================================================= */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run: vercel env pull .env.local');
  process.exit(1);
}

/* js/guests.js is a plain script declaring `var GUESTS`, so run it in
   a bare context and read the global back out. */
var src = readFileSync(new URL('../js/guests.js', import.meta.url), 'utf8');
var sandbox = {};
vm.createContext(sandbox);
new vm.Script(src).runInContext(sandbox);

var guests = sandbox.GUESTS;
if (!Array.isArray(guests) || !guests.length) {
  console.error('No GUESTS array found in js/guests.js');
  process.exit(1);
}

/* Catch the mistakes that are painful to find later: a duplicate id
   silently overwrites a family, an empty people list gives a guest a
   party with nobody in it. */
var problems = [];
var ids = new Set();
guests.forEach(function (g, i) {
  var where = 'entry ' + (i + 1) + ' (' + (g && g.id ? g.id : 'no id') + ')';
  if (!g || !g.id) problems.push(where + ': missing id');
  else if (ids.has(g.id)) problems.push(where + ': duplicate id');
  else ids.add(g.id);
  if (!g || !g.party) problems.push(where + ': missing party');
  if (!g || !Array.isArray(g.people) || !g.people.length) problems.push(where + ': no people');
});

if (problems.length) {
  console.error('The guest list has problems:\n  ' + problems.join('\n  '));
  process.exit(1);
}

var sql = neon(process.env.DATABASE_URL);

for (var g of guests) {
  await sql`
    insert into parties (id, party, people, aliases)
    values (${g.id}, ${g.party}, ${g.people}, ${g.aliases || []})
    on conflict (id) do update
      set party = excluded.party,
          people = excluded.people,
          aliases = excluded.aliases
  `;
  console.log('ok  ' + g.id + '  ' + g.party + '  (' + g.people.length + ')');
}

var seats = guests.reduce(function (n, g) { return n + g.people.length; }, 0);
console.log('\n' + guests.length + ' invitations, ' + seats + ' people.');

var orphans = await sql`
  select id, party from parties where not (id = any(${[...ids]}::text[])) order by id
`;
if (orphans.length) {
  console.log('\nIn the database but no longer in js/guests.js:');
  orphans.forEach(function (o) { console.log('  ' + o.id + '  ' + o.party); });
  console.log('Left alone — delete them by hand if that is what you want.');
}
