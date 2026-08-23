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

  /* ---------- the score ----------
     One looping <audio> element and one button, and between them a rule:
     nothing plays until the guest has touched the page.

     It starts on the first gesture, and under the curtain that gesture is
     the "Open the invitation" press — so the music comes up *with* the draw
     rather than after it. A one-shot document listener rather than a third
     curtain event: js/curtain.js speaks through curtain:reveal and
     curtain:complete, and nothing may reach inside it. The side benefit is
     that this also covers every path that skips the splash — a hash in the
     URL, a repeat run, a back/forward restore, the 4.5s safety net — where
     there is no press to hang anything on and the track simply waits for
     the guest's first tap, or for the button.

     Four things about the order below are load-bearing, and every one of
     them is there because a browser that is not Chrome does not behave
     like Chrome:

     1. The element is played on its own first, and the WebAudio gain is
        wired in only once it is *actually playing*. createMediaElementSource
        on an element that has not loaded yet — which is exactly what
        preload="none" guarantees — is the configuration Safari is worst at:
        it reports the track playing and puts out silence. Wiring the graph
        in afterwards means a graph that fails costs the fade, not the music.
     2. It starts muted and is unmuted as the gain comes in line. score.volume
        is read-only on iOS but score.muted is not, so muting is the only way
        to open quietly on a phone rather than at whatever level the file was
        mastered at.
     3. The listener is on click, not pointerdown. A pointerdown is not an
        activation-triggering event on a touch screen, so on a phone the gate
        press reached the handler before the page counted as activated and
        play() was refused. curtain:reveal is wired up as a backstop, so
        "the invitation is open" and "the music is playing" cannot come
        apart. A refused play() puts the listener back either way: one
        gesture the browser declined to count must not cost the guest the
        music for the rest of the visit.
     4. The three megabytes are fetched by hand, on an idle callback, while
        the guest is still reading the title card — not on window load, which
        on this page waits for the painting and every ornament. Without it
        the press is followed by a wait rather than by music, which a guest
        cannot tell apart from nothing having happened.

     The level still goes through a gain node rather than score.volume,
     because iOS ignores volume. It is a platform API, not a dependency —
     the page still has exactly one front-end dependency.

     No storage anywhere: a guest who has silenced the music has silenced it
     for this page session, the same way the curtain runs once. */
  var score = document.getElementById('score'),
      sound = document.querySelector('.sound');

  if(score && sound){
    var LEVEL = 0.45,                // under the room, not in it
        FADE  = 1.2;                 // seconds, both ways

    var wants  = false,              // what the guest has asked for
        routed = false,              // the gain node is in line
        stopFade = 0,
        /* audioCtx, not ctx: the petal canvas already holds a `var ctx`
           at this IIFE's scope, and a second one here would blank it.
           null: not built yet. false: no WebAudio, use the element. */
        audioCtx = null, audioGain = null;

    /* The context is built inside the gesture handler even though the graph
       is not: Safari will only start one from a user gesture, and by the
       time 'playing' arrives that gesture is long over. */
    function context(){
      if(audioCtx !== null) return audioCtx;
      var AC = window.AudioContext || window.webkitAudioContext;
      try{ audioCtx = AC ? new AC() : false; }
      catch(e){ audioCtx = false; }
      return audioCtx;
    }

    /* Put the gain node in line and give it the level. Once only —
       createMediaElementSource may be called a single time per element —
       and never before the element is playing. */
    function route(){
      if(routed) return;
      routed = true;
      var c = context();
      try{
        if(!c) throw 0;
        audioGain = c.createGain();
        audioGain.gain.value = 0;
        c.createMediaElementSource(score).connect(audioGain).connect(c.destination);
        score.muted = false;                 // the gain is the level now
        ramp(wants ? LEVEL : 0);
      }catch(e){
        /* No graph: the element is the level, which on iOS means the file's
           own. Loud is a worse invitation than quiet, but both beat silent. */
        audioGain = null;
        score.muted = false;
        score.volume = LEVEL;
      }
    }
    score.addEventListener('playing', route);

    /* A track that arrives at full level reads as a mistake, and one that
       stops dead reads as a fault, so both ends are ramped. With no gain
       node there is nothing to ramp and the pause has to be immediate: a
       1.2s wait would just be 1.2s of music after the guest said stop. */
    function ramp(to, then){
      if(!audioGain){ if(then) then(); return; }
      var t = audioCtx.currentTime;
      audioGain.gain.cancelScheduledValues(t);
      audioGain.gain.setValueAtTime(audioGain.gain.value, t);
      audioGain.gain.linearRampToValueAtTime(to, t + FADE);
      if(then) stopFade = setTimeout(then, FADE * 1000);
    }

    function mark(){
      if(wants) sound.removeAttribute('data-off');
      else sound.setAttribute('data-off','');
      sound.setAttribute('aria-label', wants ? 'Mute music' : 'Play music');
    }

    /* One place decides what the element is doing, from two facts: what the
       guest asked for, and whether the tab is in front of them. Music out of
       a tab nobody is looking at is the thing everyone hates about a page
       like this. */
    function apply(){
      clearTimeout(stopFade);
      if(wants && !document.hidden){
        /* A muted element is allowed to play with no gesture at all, and is
           then silenced again the moment it is unmuted — a failure with no
           rejection to catch. If the page has never been activated, don't
           start; the toggle is a gesture and will. */
        var act = window.navigator.userActivation;
        if(act && !act.hasBeenActive){ wants = false; mark(); listen(); return; }

        var c = context();
        if(c && c.state === 'suspended') c.resume();
        if(!routed) score.muted = true;      // quiet until the gain is in line
        var p = score.play();
        if(p && p.then) p.then(settled, refused);
        if(routed) ramp(LEVEL);
      }else{
        ramp(0, function(){ score.pause(); });
      }
      mark();
    }

    /* play() has resolved, so playback has begun and 'playing' — which is
       what wires the gain in and takes the mute off — should already have
       landed. If it has not, wire it anyway: a missed event must cost a
       moment, not the whole track. */
    function settled(){
      setTimeout(function(){ if(!routed && !score.paused) route(); }, 600);
    }

    /* The browser would not start it. Not an error — a gesture it declined
       to count. Go back to off and start listening again, so the next one
       tries rather than leaving the guest a button they have to notice. */
    function refused(){
      wants = false;
      score.muted = false;
      mark();
      listen();
    }

    /* click, NOT pointerdown, and the difference is the whole bug this
       replaced. A pointerdown is not an activation-triggering event on a
       touch screen — the browser grants activation on pointerup/click — so
       on a phone the gate press arrived here *before* the page counted as
       activated, play() was refused, and the guest opened the invitation
       onto a struck-through note and silence. click is granted activation
       everywhere, and a button gives you one for a tap, a mouse press and
       a keyboard Enter alike. */
    function listen(){
      document.addEventListener('click', start, true);
      document.addEventListener('keydown', start, true);
    }
    function unlisten(){
      document.removeEventListener('click', start, true);
      document.removeEventListener('keydown', start, true);
    }
    /* The toggle is excluded, and the exclusion is the whole point: a press
       on it is a first gesture too, and without this the button would turn
       the music on a tenth of a second before its own handler turned it
       off — a guest pressing "Play music" would get silence. */
    function start(e){
      if(wants) return;
      if(e && e.target && e.target.closest && e.target.closest('.sound')) return;
      unlisten();
      wants = true;
      apply();
    }
    /* Capture, and on the document: the press that matters belongs to the
       curtain's own button, which this file may not touch. */
    listen();

    /* And the backstop, which is also the plainest statement of the rule:
       when the invitation is open, the music is playing. By the time this
       fires the guest has pressed the gate, so the activation is in hand —
       and on the paths where the curtain dismisses itself with nobody
       having pressed anything, play() is refused and start() simply waits
       for a real gesture, which is the same graceful fallback as before. */
    document.addEventListener('curtain:reveal', function(){ start(); });

    sound.addEventListener('click', function(){
      unlisten();
      wants = !wants;
      apply();
    });

    document.addEventListener('visibilitychange', function(){
      if(wants || !score.paused) apply();
    });

    /* Start the fetch while the guest is still reading the title card. Not
       on window load: that waits for the painting and every ornament, which
       on this page is seconds, and the fetch would then be racing the press
       instead of finishing before it. An idle callback gets out of the way
       of the first paint and the curtain's own opening, and the 2s timeout
       is the promise that it happens anyway. */
    function buffer(){
      if(score.paused && !routed){ score.preload = 'auto'; score.load(); }
    }
    if(window.requestIdleCallback) requestIdleCallback(buffer, {timeout: 2000});
    else setTimeout(buffer, 1200);

    mark();
  }


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

  function personRow(name, i, pre, locked){
    var li = document.createElement('li');
    li.className = 'roster__row';
    if(pre === 'no') li.classList.add('is-no');

    var label = document.createElement('span');
    label.className = 'roster__name';
    label.textContent = name;

    /* An invitation is answered once. A party that has answered is
       shown what it said, as text — not as a control that looks
       pressable and is not. */
    if(locked){
      var ans = document.createElement('span');
      ans.className = 'roster__ans';
      ans.textContent = pre === 'yes' ? 'Coming' : pre === 'no' ? 'Can\u2019t come' : '\u2014';
      li.appendChild(label); li.appendChild(ans);
      return li;
    }

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
    /* answeredAt, not the answers themselves, is what says this
       invitation is spent — it is set from the same `responses` row
       /api/rsvp counts when it refuses a second submission, so the
       two cannot disagree and strand a guest in front of a form the
       server will not take. */
    var again = !!p.answeredAt;
    people.forEach(function(_, i){
      if(pre[i] === 'yes' || pre[i] === 'no') answers[i] = pre[i];
    });

    $('partyName').textContent = p.party || people.join(' & ');
    /* The line under the name only says something when there is
       something to say: a party that has answered before is told so.
       A first visit gets the roster straight away — the buttons are
       the instruction. */
    var sub = $('partySub');
    if(again){
      var on = answeredOn(p.answeredAt);
      sub.textContent = 'You answered' + (on ? ' on ' + on : ' already') +
        '. This is the answer we have.';
    } else {
      sub.textContent = '';
    }
    sub.hidden = !again;

    sendBtn.hidden = again;
    $('another').hidden = !again;

    var ul = $('roster');
    ul.innerHTML = '';
    people.forEach(function(name, i){ ul.appendChild(personRow(name, i, pre[i], again)); });

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
      if(r.ok) return;
      /* 409 is the one refusal a guest can act on: the invitation has
         already been answered. Everything else is ours to apologise for. */
      var e = new Error('Request failed: ' + r.status);
      e.answered = r.status === 409;
      throw e;
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
        err.textContent = e && e.answered
          ? 'This invitation has already been answered — search for it again to see the reply we have.'
          : 'That did not send. Check your connection and try once more.';
      })
      .then(function(){
        sendBtn.disabled = false;
        sendBtn.innerHTML = sendDefault;
      });
  });

  $('again').addEventListener('click', backToLookup);
  $('another').addEventListener('click', backToLookup);
})();
