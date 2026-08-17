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

  /* ---------- curtain + lantern ignition ---------- */
  window.addEventListener('load', function(){
    document.body.classList.add('ready');
    setTimeout(function(){ document.getElementById('artwrap').classList.add('lit'); }, reduce ? 0 : 700);
  });
  setTimeout(function(){ document.body.classList.add('ready'); }, 2600); // safety net

  /* ---------- scroll reveals ---------- */
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {threshold:.16, rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });


  /* ---------- petals ---------- */
  var cv = document.getElementById('petals'), ctx = cv.getContext('2d'), petals = [], W, H, DPR;
  function size(){
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W*DPR; cv.height = H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  function Petal(burst){
    this.x = Math.random()*W;
    this.y = burst ? H + 20 : Math.random()*-H;
    this.vy = burst ? -(2.4+Math.random()*2.6) : .35 + Math.random()*.75;
    this.vx = (Math.random()-.5)*.5;
    this.r = 4 + Math.random()*6;
    this.rot = Math.random()*Math.PI;
    this.spin = (Math.random()-.5)*.03;
    this.sw = Math.random()*Math.PI*2;
    this.op = .35 + Math.random()*.4;
    this.hue = Math.random() < .3 ? '#C9707A' : (Math.random() < .5 ? '#E8A9A6' : '#F2C6C0');
    this.burst = !!burst;
  }
  Petal.prototype.step = function(){
    this.sw += .02;
    this.y += this.vy;
    this.x += this.vx + Math.sin(this.sw)*.7;
    this.rot += this.spin;
    if(this.burst){ this.vy += .045; this.op -= .004; }
    if(this.y > H + 30 && !this.burst){ this.y = -20; this.x = Math.random()*W; }
  };
  Petal.prototype.draw = function(){
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
    ctx.globalAlpha = Math.max(0, this.op); ctx.fillStyle = this.hue;
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
      el.textContent = k === 'd' ? out.d : pad(out[k]);
    });
  }
  counter(); setInterval(counter, 1000);

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

  function personRow(name, i){
    var li = document.createElement('li');
    li.className = 'roster__row';

    var label = document.createElement('span');
    label.className = 'roster__name';
    label.textContent = name;

    var seg = document.createElement('div');
    seg.className = 'seg roster__seg';
    seg.setAttribute('role','group');
    seg.setAttribute('aria-label', name);

    [['yes','Attending'],['no','Unable']].forEach(function(pair){
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.v = pair[0];
      b.dataset.i = i;
      b.setAttribute('aria-pressed','false');
      b.textContent = pair[1];
      seg.appendChild(b);
    });

    li.appendChild(label); li.appendChild(seg);
    return li;
  }

  function showParty(p){
    party = p; answers = {};
    var people = p.people || [];

    $('partyName').textContent = p.party || people.join(' & ');
    $('partySub').textContent = people.length === 1
      ? 'One seat is held in your name. Tell us whether we should keep it warm.'
      : count(people.length) + ' seats are held in your name. Tell us who will fill them.';

    var ul = $('roster');
    ul.innerHTML = '';
    people.forEach(function(name, i){ ul.appendChild(personRow(name, i)); });

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

  $('notyou').addEventListener('click', backToLookup);

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
  var sendLabel = sendBtn.innerHTML;

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

    var contact = $('femail').value.trim();
    if(coming.length && !contact){
      err.textContent = 'Add an email or phone number so we can reach you.';
      $('femail').focus();
      return;
    }
    err.textContent = '';

    var payload = {
      partyId: party.id || '',
      party: party.party || people.join(' & '),
      name: people.join(', '),
      responses: people.map(function(n, i){ return {name:n, attending:answers[i]}; }),
      attending: coming.length ? 'yes' : 'no',
      seats: coming.length,
      invited: people.length,
      contact: contact,
      song: $('fsong').value.trim(),
      notes: $('fdiet').value.trim(),
      message: $('fmsg').value.trim(),
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

  $('again').addEventListener('click', function(){
    ['femail','fsong','fdiet','fmsg'].forEach(function(id){ $(id).value = ''; });
    backToLookup();
  });
})();
