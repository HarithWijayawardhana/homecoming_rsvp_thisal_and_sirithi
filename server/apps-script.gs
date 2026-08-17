/**
 * RSVP collector for the Thisal & Sirithi homecoming page.
 *
 * Setup:
 *  1. Create a Google Sheet. First row headers:
 *     Received | Name | Contact | Attending | Seats | Song | Notes | Message
 *  2. Extensions > Apps Script, paste this file, save.
 *  3. Deploy > New deployment > type "Web app".
 *       Execute as:  Me
 *       Who has access:  Anyone
 *  4. Copy the /exec URL into RSVP_ENDPOINT at the top of js/main.js.
 *
 * Re-deploy (Manage deployments > edit > new version) after any edit here,
 * otherwise the old code keeps running.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    sheet.appendRow([
      new Date(),
      data.name || '',
      data.contact || '',
      data.attending === 'yes' ? 'Attending' : 'Cannot attend',
      data.seats || 0,
      data.song || '',
      data.notes || '',
      data.message || ''
    ]);

    // Optional: email yourself on every response.
    // MailApp.sendEmail('you@example.com', 'RSVP: ' + data.name,
    //   data.name + ' — ' + data.attending + ' (' + data.seats + ' seats)');

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput('RSVP endpoint is live.');
}
