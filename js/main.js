/* =============================================================
   Thisal & Sirithi — homecoming reception
   ============================================================= */

/* Where a response goes. '/api/rsvp' is the function in api/rsvp.js,
   which writes to Neon Postgres (see README).
   Leave it empty and responses are only logged to the console. */
var RSVP_ENDPOINT = '/api/rsvp';

/* Where the name lookup gets its guest list.
   Empty  — matches are found in js/guests.js, in the browser.
   Set it — the list stays in the database and never ships to the
            page. index.html no longer loads js/guests.js, so this
            has to stay set. Nothing else has to change. */
var LOOKUP_ENDPOINT = '/api/lookup';

(function(){
  "use strict";
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the page behind the curtain ----------
     js/curtain.js owns the drape and nothing else. This is the other
     half of that contract: the page holds its hero back, waits for the
     curtain's `reveal` event, and then brings it up — the arch fading
     and scaling in from 0.96, the lamps catching, and the copy
     staggering after them.

     Two events rather than one shared timeline, deliberately. The
     curtain module stays liftable into another page, and this file
     never reaches inside it.

     The hero is hidden at load, not at reveal: the arch is already
     open by then, so setting opacity to 0 at that point would be a
     visible blink rather than a fade. */
  var STATE = window.__homecoming || (window.__homecoming = {});
  var G = window.gsap;
  var still = reduce || !G;

  var artwrap   = document.getElementById('artwrap'),
      heroItems = [].slice.call(document.querySelectorAll('.hero .reveal')),
      form      = document.getElementById('lookupview'),
      formItems = form ? [].slice.call(form.children) : [];

  /* Hand an element to GSAP: the CSS reveal transitions the same two
     properties a tween is about to write every frame, so it is opted
     out (data-g, which the observer below skips) and shown. */
  function claim(list){
    list.forEach(function(el){ el.setAttribute('data-g','1'); el.classList.add('in'); });
  }

  if(!still){
    claim(heroItems);
    if(form) claim([form]);
    G.set(heroItems, {opacity:0, y:26});
    if(artwrap) G.set(artwrap, {opacity:0, scale:0.96});
  }

  function revealHero(){
    if(STATE.heroRevealed) return;
    STATE.heroRevealed = true;
    document.body.classList.add('ready');

    if(still){
      if(artwrap) artwrap.classList.add('lit');
      armForm();
      return;
    }

    G.timeline()
      .to(artwrap, {opacity:1, scale:1, duration:.95, ease:'power2.out',
                    clearProps:'transform,opacity'}, 0)
      .to(heroItems, {opacity:1, y:0, duration:.55, stagger:.07, ease:'power2.out',
                      clearProps:'opacity,transform'}, .12)
      .add(function(){ if(artwrap) artwrap.classList.add('lit'); }, .3)
      .add(function(){ goldBurst(); }, 0)      // motes rising through the arch
      .add(armForm, .85);
  }

  /* The RSVP form is several screens below the fold when the curtain
     finishes, so its stagger is armed rather than fired: it plays when
     the form actually comes into view. Running it on a section nobody
     is looking at spends the animation for nothing. A guest who
     arrived at #rsvp gets it straight away. */
  function armForm(){
    if(still || !form || STATE.formRevealed) return;
    if(form.getBoundingClientRect().top < window.innerHeight * .85){ revealForm(); return; }
    G.set(formItems, {opacity:0, y:18});
    var fio = new IntersectionObserver(function(en){
      if(en[0].isIntersecting){ fio.disconnect(); revealForm(); }
    }, {threshold:.25});
    fio.observe(form);
  }

  function revealForm(){
    if(STATE.formRevealed) return;
    STATE.formRevealed = true;
    G.fromTo(formItems, {opacity:0, y:18},
      {opacity:1, y:0, duration:.6, stagger:.075, ease:'power2.out',
       clearProps:'opacity,transform'});
  }

  document.addEventListener('curtain:reveal', revealHero);

  /* A link straight to #rsvp asked for the form, not the front door. */
  if(location.hash) revealHero();

  /* The safety net. js/curtain.js is an ES module, and a module that
     fails to load fails silently — without this the hero would stay
     hidden behind a splash screen that never arrived, under a mount
     point painting velvet over the whole viewport. Nothing about the
     page may depend on the decoration in front of it.

     It tests curtainArmed, not the clock alone: the curtain waits at
     its title card until the guest presses the button, and a guest who
     takes their time over the monogram must not have it pulled away
     from them. The flag is set the moment the module has its markup in
     the document, so the failure this net is for never sets it. */
  setTimeout(function(){
    if(!STATE.heroRevealed && !STATE.curtainArmed){
      document.body.classList.remove('curtain-up');
      var root = document.getElementById('curtain-root');
      if(root){ root.removeAttribute('data-cover'); root.innerHTML = ''; }
      revealHero();
    }
  }, 4500);

  /* ---------- scroll reveals ---------- */
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {threshold:.16, rootMargin:'0px 0px -8% 0px'});
  /* [data-g] elements belong to the reveal timeline, not to this. */
  document.querySelectorAll('.reveal:not([data-g])').forEach(function(el){ io.observe(el); });


  /* ---------- petals ---------- */
  var cv = document.getElementById('petals'), ctx = cv.getContext('2d'), petals = [], W, H, DPR;
  function size(){
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W*DPR; cv.height = H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  /* mode: falsy — the drifting petals. true — the burst on a yes.
     'gold' — dust rising out of the curtain as it parts. */
  function Petal(mode){
    var gold = mode === 'gold';
    this.gold = gold;
    this.x = gold ? W*.5 + (Math.random()-.5)*W*.55 : Math.random()*W;
    this.y = mode ? H + 20 : Math.random()*-H;
    this.vy = gold ? -(1.1+Math.random()*1.9) : (mode ? -(2.4+Math.random()*2.6) : .35 + Math.random()*.75);
    this.vx = (Math.random()-.5)*(gold ? .8 : .5);
    this.r = gold ? 1.5 + Math.random()*3 : 4 + Math.random()*6;
    this.rot = Math.random()*Math.PI;
    this.spin = (Math.random()-.5)*.03;
    this.sw = Math.random()*Math.PI*2;
    this.op = gold ? .5 + Math.random()*.5 : .35 + Math.random()*.4;
    this.hue = gold ? (Math.random() < .5 ? '#F5E7CB' : '#E3C186')
                    : (Math.random() < .3 ? '#C9707A' : (Math.random() < .5 ? '#E8A9A6' : '#F2C6C0'));
    this.burst = !!mode;
  }
  Petal.prototype.step = function(){
    this.sw += .02;
    this.y += this.vy;
    this.x += this.vx + Math.sin(this.sw)*.7;
    this.rot += this.spin;
    if(this.burst){ this.vy += this.gold ? .011 : .045; this.op -= this.gold ? .0026 : .004; }
    if(this.y > H + 30 && !this.burst){ this.y = -20; this.x = Math.random()*W; }
  };
  Petal.prototype.draw = function(){
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.globalAlpha = Math.max(0, this.op); ctx.fillStyle = this.hue;
    if(this.gold){                       // dust, not a petal
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI*2); ctx.fill();
      ctx.restore(); return;
    }
    ctx.rotate(this.rot);
    ctx.beginPath();
    ctx.moveTo(0, -this.r);
    ctx.bezierCurveTo(this.r, -this.r*.6, this.r*.75, this.r*.8, 0, this.r);
    ctx.bezierCurveTo(-this.r*.75, this.r*.8, -this.r, -this.r*.6, 0, -this.r);
    ctx.fill(); ctx.restore();
  };
  function loop(){
    ctx.clearRect(0,0,W,H);
    for(var i=petals.length-1;i>=0;i--){
      petals[i].step(); petals[i].draw();
      if(petals[i].burst && (petals[i].op <= 0 || petals[i].y > H+60)) petals.splice(i,1);
    }
    requestAnimationFrame(loop);
  }
  if(!reduce){
    size();
    var n = window.innerWidth < 700 ? 12 : 22;
    for(var i=0;i<n;i++) petals.push(new Petal(false));
    requestAnimationFrame(loop);
    window.addEventListener('resize', size);
  }

  /* Dust carried up out of the parting. Called by openGate above —
     hoisted, so it does not matter that it is declared down here. */
  function goldBurst(){
    if(reduce || !W) return;
    var g = window.innerWidth < 700 ? 16 : 26;
    for(var i=0;i<g;i++) petals.push(new Petal('gold'));
  }

  /* ---------- countdown ---------- */
  var target = new Date('2026-09-26T19:00:00+05:30').getTime();
  function pad(v){ return v < 10 ? '0'+v : ''+v; }
  function counter(){
    var diff = target - Date.now(), out = {d:0,h:0,m:0,s:0};
    if(diff > 0){
      out.d = Math.floor(diff/864e5);
      out.h = Math.floor(diff%864e5/36e5);
      out.m = Math.floor(diff%36e5/6e4);
      out.s = Math.floor(diff%6e4/1000);
    }
    document.querySelectorAll('#count .n').forEach(function(el){
      var k = el.dataset.c;
      var next = k === 'd' ? String(out.d) : pad(out[k]);
      if(el.textContent === next) return;
      el.textContent = next;
      /* The digit rises into its slot rather than snapping. The clip is on
         the .mask wrapper, not on .n — an element cannot clip its own
         content while it is the thing being translated. Retriggering needs
         the class gone for a frame, which is what the reflow read buys. */
      if(reduce) return;
      el.classList.remove('roll');
      void el.offsetWidth;
      el.classList.add('roll');
    });
  }
  counter(); setInterval(counter, 1000);

  /* ---------- nav rail ----------
     Two jobs, no scroll listener: mark the section being read, and stay out
     of the way until the hero has been passed. The progress hairline is a
     scroll-driven animation in the stylesheet. */
  var nav = document.querySelector('.nav');
  if(nav){
    var navLinks = [].slice.call(nav.querySelectorAll('.nav__links a')),
        hero = document.querySelector('.hero');

    if(hero){
      /* .is-past goes on when the hero has left, which is also the only
         moment the rail has anything to sit against. */
      new IntersectionObserver(function(entries){
        nav.classList.toggle('is-past', !entries[0].isIntersecting);
      }, {threshold:0, rootMargin:'-40% 0px 0px 0px'}).observe(hero);
    }

    var sections = navLinks.map(function(a){
      return document.querySelector(a.getAttribute('href'));
    });
    /* One winner, not a set. A band this narrow can still have two sections
       in it at a boundary, and two underlined links read as a bug — so the
       observer only tells us something moved, and the section whose middle
       is nearest the middle of the screen is the one that gets marked. */
    function markNearest(){
      var mid = window.innerHeight / 2, best = -1, bestD = Infinity;
      sections.forEach(function(s, i){
        if(!s) return;
        var r = s.getBoundingClientRect();
        if(r.bottom < 0 || r.top > window.innerHeight) return;
        var d = Math.abs((r.top + r.bottom) / 2 - mid);
        if(d < bestD){ bestD = d; best = i; }
      });
      navLinks.forEach(function(a, i){
        if(i === best) a.setAttribute('aria-current','true');
        else a.removeAttribute('aria-current');
      });
    }
    var seen = new IntersectionObserver(markNearest, {threshold:[0, .25, .5, .75, 1]});
    sections.forEach(function(s){ if(s) seen.observe(s); });

  }

  /* Every in-page anchor on the page, not just the rail: the hero's two
     buttons, the story's last chapter and the footer all point at hashes
     too. The hrefs are real, for the keyboard and for no-JS. But a hash
     left in the address bar means the next load of this URL skips the
     curtain (see the location.hash check above), and a guest who forwards
     the link should not be handing on a page with no curtain — so scroll,
     then put the address bar back. */
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if(!a || a.getAttribute('href') === '#') return;
    var el = document.querySelector(a.getAttribute('href'));
    if(!el) return;
    e.preventDefault();
    el.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'start'});
    history.replaceState(null, '', location.pathname + location.search);
  });

  /* ---------- rsvp, step one: find the invitation ---------- */
  var $ = function(id){ return document.getElementById(id); };

  var lookupview = $('lookupview'), partyshell = $('partyshell'), qname = $('qname'),
      lookerr = $('lookerr'), choices = $('choices'), findBtn = $('find');

  /* lowercase, unaccented, punctuation stripped — so "Dé Silva," finds "de silva" */
  function norm(s){
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  /* every string that should find this party */
  function haystack(p){
    return [p.party].concat(p.people || [], p.aliases || []).map(norm).filter(Boolean);
  }

  function localMatches(q){
    var query = norm(q);
    if(query.length < 2) return [];
    var words = query.split(' ');
    return (window.GUESTS || []).filter(function(p){
      return haystack(p).some(function(h){
        if(h === query || h.indexOf(query) === 0) return true;
        var toks = h.split(' ');
        // any single word they typed, matched against the start of any word we hold
        if(words.length === 1) return toks.some(function(t){ return t.indexOf(query) === 0; });
        // several words: each must find a home, in any order
        return words.every(function(w){ return toks.some(function(t){ return t.indexOf(w) === 0; }); });
      });
    });
  }

  /* The one seam between the flow and the guest list. Swap the source here
     and everything downstream keeps working. */
  function lookupParty(q){
    if(!LOOKUP_ENDPOINT) return Promise.resolve(localMatches(q));
    var url = LOOKUP_ENDPOINT + (LOOKUP_ENDPOINT.indexOf('?') < 0 ? '?' : '&') + 'q=' + encodeURIComponent(q);
    // a plain GET with no custom headers — no CORS preflight for Apps Script to fail
    return fetch(url).then(function(r){
      if(!r.ok) throw new Error('Lookup failed: ' + r.status);
      return r.json();
    }).then(function(d){ return (d && d.parties) || []; });
  }

  findBtn.dataset.label = findBtn.textContent;

  lookupview.addEventListener('submit', function(e){
    e.preventDefault();
    var q = qname.value.trim();
    choices.hidden = true; choices.innerHTML = '';
    if(q.length < 2){
      lookerr.textContent = 'Please type the name as it appears on your envelope.';
      qname.focus();
      return;
    }
    lookerr.textContent = '';
    findBtn.disabled = true; findBtn.textContent = 'Looking…';

    lookupParty(q)
      .then(function(found){
        if(!found.length){
          lookerr.textContent = 'We could not find that name. Try a surname on its own, or the name exactly as it is written on the envelope.';
          qname.focus();
        } else if(found.length === 1){
          showParty(found[0]);
        } else {
          offerChoice(found);
        }
      })
      .catch(function(e){
        console.error(e);
        lookerr.textContent = 'We could not check the list just now. Check your connection and try once more.';
      })
      .then(function(){
        findBtn.disabled = false; findBtn.textContent = findBtn.dataset.label;
      });
  });

  /* more than one envelope answers to that name */
  function offerChoice(list){
    lookerr.textContent = 'More than one invitation goes by that name — which is yours?';
    list.forEach(function(p){
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.party || (p.people || []).join(' & ');
      b.addEventListener('click', function(){ showParty(p); });
      choices.appendChild(b);
    });
    choices.hidden = false;
  }

  /* ---------- rsvp, step two: who is coming ---------- */
  var party = null;      // the invitation being answered
  var answers = {};      // person index -> 'yes' | 'no'

  var WORDS = ['no','One','Two','Three','Four','Five','Six','Seven','Eight'];
  function count(n){ return WORDS[n] || String(n); }

  function personRow(name, i, pre){
    var li = document.createElement('li');
    li.className = 'roster__row';
    if(pre === 'no') li.classList.add('is-no');

    var label = document.createElement('span');
    label.className = 'roster__name';
    label.textContent = name;

    var seg = document.createElement('div');
    seg.className = 'seg roster__seg';
    seg.setAttribute('role','group');
    seg.setAttribute('aria-label', name);

    [['yes','Coming'],['no','Can’t come']].forEach(function(pair){
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.v = pair[0];
      b.dataset.i = i;
      b.setAttribute('aria-pressed', pair[0] === pre ? 'true' : 'false');
      b.textContent = pair[1];
      seg.appendChild(b);
    });

    li.appendChild(label); li.appendChild(seg);
    return li;
  }

  /* the day an earlier answer was sent, for the line above the roster */
  function answeredOn(iso){
    var d = new Date(iso || '');
    if(isNaN(d.getTime())) return '';
    try { return d.toLocaleDateString(undefined, {day:'numeric', month:'long'}); }
    catch(e){ return ''; }
  }

  function showParty(p){
    party = p; answers = {};
    var people = p.people || [];

    /* /api/lookup hands back the party's most recent response, one
       'yes' / 'no' / null per name. A guest who has answered before
       should find the roster as they left it, not blank. */
    var pre = Array.isArray(p.answers) ? p.answers : [];
    var again = false;
    people.forEach(function(_, i){
      if(pre[i] === 'yes' || pre[i] === 'no'){ answers[i] = pre[i]; again = true; }
    });

    $('partyName').textContent = p.party || people.join(' & ');
    if(again){
      var on = answeredOn(p.answeredAt);
      $('partySub').textContent = 'You answered' + (on ? ' on ' + on : ' already') +
        ', and your answer is kept below. Change whatever has changed and send it again.';
    } else {
      $('partySub').textContent = people.length === 1
        ? 'A seat is held in your name — let us know if we should keep it warm.'
        : count(people.length) + ' seats are held in your name — let us know who will fill them.';
    }

    sendLabel = again ? 'Update our response <span class="arw">&#8594;</span>' : sendDefault;
    sendBtn.innerHTML = sendLabel;

    var ul = $('roster');
    ul.innerHTML = '';
    people.forEach(function(name, i){ ul.appendChild(personRow(name, i, pre[i])); });

    $('err').textContent = '';
    $('sealed').classList.remove('on');
    $('partyview').style.display = '';

    lookupview.hidden = true;
    partyshell.hidden = false;
    partyshell.classList.add('in');
    $('partyName').focus({preventScroll:true});
    partyshell.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'center'});
  }

  $('roster').addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    var row = b.closest('.roster__row');
    [].forEach.call(row.querySelectorAll('button'), function(x){ x.setAttribute('aria-pressed','false'); });
    b.setAttribute('aria-pressed','true');
    answers[b.dataset.i] = b.dataset.v;
    row.classList.toggle('is-no', b.dataset.v === 'no');
    $('err').textContent = '';
  });

  function backToLookup(){
    partyshell.hidden = true;
    partyshell.classList.remove('in');
    lookupview.hidden = false;
    party = null; answers = {};
    lookerr.textContent = '';
    choices.hidden = true; choices.innerHTML = '';
    qname.value = '';
    qname.focus({preventScroll:true});
    lookupview.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'center'});
  }

  function sendResponse(payload){
    if(!RSVP_ENDPOINT){
      console.log('RSVP (no endpoint set):', payload);
      return Promise.resolve();
    }
    // text/plain avoids a CORS preflight, which Google Apps Script cannot answer.
    return fetch(RSVP_ENDPOINT, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(payload)
    }).then(function(r){
      if(!r.ok) throw new Error('Request failed: ' + r.status);
    });
  }

  function celebrate(coming, staying){
    var going = coming.length > 0;
    var first = function(n){ return n.split(' ')[0]; };

    $('sealTitle').textContent = going
      ? (coming.length === 1 ? 'Your seat is saved' : 'Your seats are saved')
      : 'You will be missed';

    $('sealBody').textContent = going
      ? 'Thank you, ' + first(coming[0]) + '. ' +
        (coming.length === 1 ? 'A seat is held for you' : count(coming.length).toLowerCase() + ' seats are held for you') +
        (staying.length ? ', and we are sorry ' + staying.map(first).join(' and ') + ' cannot be with us' : '') +
        '. The lanterns will be lit and the ballroom will be waiting — we will send the finer details closer to the day.'
      : 'Thank you for telling us. You will be thought of on the night, and we hope to celebrate with you soon.';

    $('partyview').style.display = 'none';
    $('sealed').classList.add('on');

    if(!reduce){
      document.body.classList.add('flare');
      setTimeout(function(){ document.body.classList.remove('flare'); }, 2500);
      if(going){ for(var i=0;i<60;i++) petals.push(new Petal(true)); }
    }
  }

  var sendBtn = $('send');
  var sendDefault = sendBtn.innerHTML;   // "Confirm our response"
  var sendLabel = sendDefault;           // showParty swaps it for a repeat answer

  sendBtn.addEventListener('click', function(){
    if(!party) return;
    var err = $('err');
    var people = party.people || [];

    var unanswered = people.filter(function(_, i){ return !answers[i]; });
    if(unanswered.length){
      err.textContent = unanswered.length === people.length
        ? 'Let us know who will be joining us.'
        : 'Still to answer for ' + unanswered.join(' and ') + '.';
      return;
    }

    var coming  = people.filter(function(_, i){ return answers[i] === 'yes'; });
    var staying = people.filter(function(_, i){ return answers[i] === 'no'; });

    err.textContent = '';

    var payload = {
      partyId: party.id || '',
      party: party.party || people.join(' & '),
      name: people.join(', '),
      responses: people.map(function(n, i){ return {name:n, attending:answers[i]}; }),
      attending: coming.length ? 'yes' : 'no',
      seats: coming.length,
      invited: people.length,
      sentAt: new Date().toISOString()
    };

    sendBtn.disabled = true;
    sendBtn.innerHTML = 'Sending&hellip;';

    sendResponse(payload)
      .then(function(){ celebrate(coming, staying); })
      .catch(function(e){
        console.error(e);
        err.textContent = 'That did not send. Check your connection and try once more.';
      })
      .then(function(){
        sendBtn.disabled = false;
        sendBtn.innerHTML = sendLabel;
      });
  });

  $('again').addEventListener('click', backToLookup);
})();
