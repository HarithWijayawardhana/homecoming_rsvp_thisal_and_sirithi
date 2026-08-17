/* =============================================================
   The one connection to Neon.

   neon() is created inside db(), never at module top level, so an
   unset DATABASE_URL fails on the request that needs it rather than
   taking the whole function down at import time. Deliberately not a
   Proxy wrapper — those break libraries that inspect the client.

   Files in api/ that start with _ are helpers; Vercel does not turn
   them into routes.
   ============================================================= */

import { neon } from '@neondatabase/serverless';

var _sql = null;

export function db() {
  if (_sql) return _sql;
  var url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  _sql = neon(url);
  return _sql;
}
