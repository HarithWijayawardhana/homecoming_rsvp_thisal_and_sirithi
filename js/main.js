/* =============================================================
   Thisal & Sirithi — homecoming reception
   ============================================================= */

/* Paste your form endpoint here (see README).
   Leave it empty and responses are only logged to the console. */
var RSVP_ENDPOINT = '';

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

  /* ---------- rsvp ---------- */
  var state = {attend:'', guests:'1'};
  function bindSeg(id, key){
    var box = document.getElementById(id);
    box.addEventListener('click', function(e){
      var b = e.target.closest('button'); if(!b) return;
      [].forEach.call(box.querySelectorAll('button'), function(x){ x.setAttribute('aria-pressed','false'); });
      b.setAttribute('aria-pressed','true');
      state[key] = b.dataset.v;
      if(key === 'attend'){
        document.getElementById('guestsField').style.display = (b.dataset.v === 'no') ? 'none' : '';
      }
      document.getElementById('err').textContent = '';
    });
  }
  bindSeg('attend','attend'); bindSeg('guests','guests');

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

  function celebrate(name, going){
    document.getElementById('sealTitle').textContent = going ? 'Your seat is saved' : 'You will be missed';
    document.getElementById('sealBody').textContent = going
      ? 'Thank you, ' + name.split(' ')[0] + '. The lanterns will be lit and the ballroom will be waiting. We will send the finer details closer to the day.'
      : 'Thank you for telling us, ' + name.split(' ')[0] + '. You will be thought of on the night, and we hope to celebrate with you soon.';

    document.getElementById('formview').style.display = 'none';
    document.getElementById('sealed').classList.add('on');

    if(!reduce){
      document.body.classList.add('flare');
      setTimeout(function(){ document.body.classList.remove('flare'); }, 2500);
      if(going){ for(var i=0;i<60;i++) petals.push(new Petal(true)); }
    }
  }

  var sendBtn = document.getElementById('send');
  var sendLabel = sendBtn.innerHTML;

  sendBtn.addEventListener('click', function(){
    var name = document.getElementById('fname').value.trim();
    var contact = document.getElementById('femail').value.trim();
    var err = document.getElementById('err');
    if(!name){ err.textContent = 'Please add your name so we know whose seat to hold.'; document.getElementById('fname').focus(); return; }
    if(!contact){ err.textContent = 'Add an email or phone number so we can reach you.'; document.getElementById('femail').focus(); return; }
    if(!state.attend){ err.textContent = 'Let us know whether you can join us.'; return; }
    err.textContent = '';

    var payload = {
      name: name,
      contact: contact,
      attending: state.attend,
      seats: state.attend === 'no' ? 0 : state.guests,
      song: document.getElementById('fsong').value.trim(),
      notes: document.getElementById('fdiet').value.trim(),
      message: document.getElementById('fmsg').value.trim(),
      sentAt: new Date().toISOString()
    };

    sendBtn.disabled = true;
    sendBtn.innerHTML = 'Sending&hellip;';

    sendResponse(payload)
      .then(function(){ celebrate(name, state.attend === 'yes'); })
      .catch(function(e){
        console.error(e);
        err.textContent = 'That did not send. Check your connection and try once more.';
      })
      .then(function(){
        sendBtn.disabled = false;
        sendBtn.innerHTML = sendLabel;
      });
  });

  document.getElementById('again').addEventListener('click', function(){
    document.getElementById('sealed').classList.remove('on');
    document.getElementById('formview').style.display = '';
    ['fname','femail','fsong','fdiet','fmsg'].forEach(function(id){ document.getElementById(id).value = ''; });
    state = {attend:'', guests:'1'};
    document.querySelectorAll('#attend button').forEach(function(b){ b.setAttribute('aria-pressed','false'); });
    document.getElementById('guestsField').style.display = '';
    document.getElementById('fname').focus();
  });
})();
