/**
 * RSVP collector for the Thisal & Sirithi homecoming page.
 *
 * The page asks for the name on the envelope, finds that party, and returns
 * one answer per person. This script writes one row per person.
 *
 * Setup:
 *  1. Create a Google Sheet with two tabs:
 *
 *     "Responses"  — headers in row 1:
 *        Received | Party | Name | Attending | Seats coming | Invited |
 *        Contact | Song | Notes | Message
 *
 *     "Guests"     — only needed if you want the lookup served from here
 *                    instead of js/guests.js. Headers in row 1:
 *        Id | Party | People | Aliases
 *        People and Aliases are comma separated, e.g.
 *        perera-01 | The Perera family | Nimal Perera, Kumari Perera | perera family
 *
 *  2. Extensions > Apps Script, paste this file, save.
 *  3. Deploy > New deployment > type "Web app".
 *       Execute as:  Me
 *       Who has access:  Anyone
 *  4. Copy the /exec URL into RSVP_ENDPOINT at the top of js/main.js.
 *     Set LOOKUP_ENDPOINT to the same URL to keep the guest list off the page.
 *
 * Re-deploy (Manage deployments > edit > new version) after any edit here,
 * otherwise the old code keeps running.
 */

var RESPONSES_TAB = 'Responses';
var GUESTS_TAB = 'Guests';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = tab(RESPONSES_TAB) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var now = new Date();

    var people = data.responses && data.responses.length
      ? data.responses
      : [{ name: data.name || '', attending: data.attending || '' }];

    // one row per person, so a party of four reads as four lines
    people.forEach(function (person) {
      sheet.appendRow([
        now,
        data.party || '',
        person.name || '',
        person.attending === 'yes' ? 'Attending' : 'Cannot attend',
        data.seats || 0,
        data.invited || people.length,
        data.contact || '',
        data.song || '',
        data.notes || '',
        data.message || ''
      ]);
    });

    // Optional: email yourself on every response.
    // MailApp.sendEmail('you@example.com', 'RSVP: ' + data.party,
    //   data.party + ' — ' + data.seats + ' of ' + data.invited + ' attending');

    return json({ ok: true });

  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/**
 * Name lookup. Called only when LOOKUP_ENDPOINT is set in js/main.js.
 *   GET  ...exec?q=nimal
 *   ->   { "parties": [ { id, party, people } ] }
 * Aliases are used for matching but never returned.
 */
function doGet(e) {
  var q = e && e.parameter ? e.parameter.q : '';
  if (!q) return ContentService.createTextOutput('RSVP endpoint is live.');

  try {
    var query = norm(q);
    if (query.length < 2) return json({ parties: [] });
    var words = query.split(' ');

    var parties = guestList().filter(function (p) {
      return p.haystack.some(function (h) {
        if (h === query || h.indexOf(query) === 0) return true;
        var toks = h.split(' ');
        if (words.length === 1) {
          return toks.some(function (t) { return t.indexOf(query) === 0; });
        }
        return words.every(function (w) {
          return toks.some(function (t) { return t.indexOf(w) === 0; });
        });
      });
    }).map(function (p) {
      return { id: p.id, party: p.party, people: p.people };
    });

    return json({ parties: parties });

  } catch (err) {
    return json({ parties: [], error: String(err) });
  }
}

function guestList() {
  var sheet = tab(GUESTS_TAB);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  rows.shift(); // headers

  return rows.filter(function (r) { return r[0] || r[1]; }).map(function (r) {
    var people = split(r[2]);
    var aliases = split(r[3]);
    return {
      id: String(r[0] || ''),
      party: String(r[1] || ''),
      people: people,
      haystack: [String(r[1] || '')].concat(people, aliases).map(norm).filter(String)
    };
  });
}

function split(v) {
  return String(v == null ? '' : v).split(',').map(function (s) { return s.trim(); }).filter(String);
}

function norm(s) {
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function tab(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
