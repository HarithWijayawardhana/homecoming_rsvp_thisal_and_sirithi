/* =============================================================
   Thisal & Sirithi — the guest list

   One entry per invitation (per envelope), not per person.

     id      a short unique key; it is what lands in the sheet
     party   how the invitation is addressed — shown as the heading
     people  every name on that envelope, in the order they should read
     aliases optional extra spellings people might type: a nickname,
             a maiden name, "amma", a shortened surname. Matching is
             already case-, accent- and punctuation-insensitive, and
             a first name or surname on its own will find the party,
             so only add an alias for something genuinely different.

   PLACEHOLDER DATA — replace the entries below with the real list
   before the invitations go out.

   Note: while the list lives in this file it ships to the browser,
   so anyone can view-source and read it. To keep it private, set
   LOOKUP_ENDPOINT in js/main.js and serve matches from the sheet
   instead; nothing else in the flow changes.
   ============================================================= */

var GUESTS = [
  {
    id: 'perera-01',
    party: 'The Perera family',
    people: ['Nimal Perera', 'Kumari Perera', 'Sanduni Perera'],
    aliases: ['perera family']
  },
  {
    id: 'fernando-01',
    party: 'Mr & Mrs Fernando',
    people: ['Ajith Fernando', 'Dilhani Fernando'],
    aliases: []
  },
  {
    id: 'silva-01',
    party: 'Ramesh & Tharushi de Silva',
    people: ['Ramesh de Silva', 'Tharushi de Silva'],
    aliases: ['de silva', 'ramesh silva']
  },
  {
    id: 'jayasinghe-01',
    party: 'Dr Chathura Jayasinghe',
    people: ['Chathura Jayasinghe'],
    aliases: ['chathu']
  },
  {
    id: 'wickrama-01',
    party: 'The Wickramasinghe family',
    people: [
      'Sunil Wickramasinghe',
      'Padma Wickramasinghe',
      'Isuru Wickramasinghe',
      'Nethmi Wickramasinghe'
    ],
    aliases: ['wickrama', 'wickramasinghe family']
  }
];
