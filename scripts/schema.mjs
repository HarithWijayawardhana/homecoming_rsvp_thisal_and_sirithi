/* =============================================================
   Creates the tables. Safe to run again — every statement is
   guarded, so it will not touch data that is already there.

     npm run db:schema

   Reads DATABASE_URL from .env.local (pull it first with
   `vercel env pull .env.local`). Plain node does not read that file
   on its own; the npm script passes --env-file.
   ============================================================= */

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run: vercel env pull .env.local');
  process.exit(1);
}

var sql = neon(process.env.DATABASE_URL);

var statements = [
  `create table if not exists parties (
     id      text primary key,
     party   text not null,
     people  text[] not null,
     aliases text[] not null default '{}'
   )`,

  `create table if not exists responses (
     id          bigserial primary key,
     party_id    text not null references parties(id),
     party       text not null,
     seats       int not null,
     invited     int not null,
     contact     text,
     song        text,
     notes       text,
     message     text,
     sent_at     timestamptz,
     received_at timestamptz not null default now()
   )`,

  `create table if not exists response_people (
     id          bigserial primary key,
     response_id bigint not null references responses(id) on delete cascade,
     name        text not null,
     attending   boolean not null
   )`,

  `create index if not exists response_people_response_id_idx
     on response_people (response_id)`,

  `create index if not exists responses_party_id_idx
     on responses (party_id)`
];

for (var stmt of statements) {
  await sql.query(stmt);
  console.log('ok  ' + stmt.split('\n')[0].trim());
}

console.log('\nSchema is ready.');
