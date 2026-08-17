/* =============================================================
   Name matching, shared by the api/ functions.

   norm() and matchParties() are copied verbatim from norm() and
   localMatches() in js/main.js. They must stay identical — if they
   drift, the browser and the server disagree about who a guest is.
   Change one, change both. (server/apps-script.gs holds a third
   copy of norm() for the optional Sheets backend.)

   Files in api/ that start with _ are helpers; Vercel does not turn
   them into routes.
   ============================================================= */

/* lowercase, unaccented, punctuation stripped — so "Dé Silva," finds "de silva" */
export function norm(s) {
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/* every string that should find this party */
function haystack(p) {
  return [p.party].concat(p.people || [], p.aliases || []).map(norm).filter(Boolean);
}

export function matchParties(parties, q) {
  var query = norm(q);
  if (query.length < 2) return [];
  var words = query.split(' ');

  return parties.filter(function (p) {
    return haystack(p).some(function (h) {
      if (h === query || h.indexOf(query) === 0) return true;
      var toks = h.split(' ');
      // any single word they typed, matched against the start of any word we hold
      if (words.length === 1) return toks.some(function (t) { return t.indexOf(query) === 0; });
      // several words: each must find a home, in any order
      return words.every(function (w) { return toks.some(function (t) { return t.indexOf(w) === 0; }); });
    });
  });
}
