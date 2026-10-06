"""
Turns your original standalone bot file into the hosted, license-gated page.

  python3 scripts/build-app.py path/to/hiopt2_latest.html

Writes public/app.html. It (1) removes the strategy tables and decision code,
replacing them with calls to /api/engine/decide, (2) adds the license lock
screen, and (3) strips the built-in self-test code. It asserts on every edit,
so if a new version of your bot changes the structure it fails loudly instead
of producing a broken page.

IMPORTANT: if you change the strategy/index TABLES in the bot, copy the
change into src/lib/engine.ts too (that's where the real tables live now) and
re-run: npx tsx scripts/engine-parity.ts path/to/hiopt2_latest.html
"""
import os, re, sys

if len(sys.argv) < 2:
    sys.exit('Usage: python3 scripts/build-app.py path/to/hiopt2_latest.html')
SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'app.html')

html = open(SRC, encoding='utf-8').read()

def must_replace(text, old, new, count=1):
    assert text.count(old) == count, f'expected {count} match(es), found {text.count(old)} for: {old[:80]!r}'
    return text.replace(old, new)

def cut_between(text, start_marker, end_marker, replacement=''):
    s = text.index(start_marker)
    e = text.index(end_marker, s)
    return text[:s] + replacement + text[e:]

# ---------------------------------------------------------------- overlay CSS
css = """
/* ---- license gate ---- */
#gate{position:fixed;inset:0;z-index:9999;background:#0d1117;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}
#gate[hidden]{display:none}
#gate .box{width:100%;max-width:440px;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:26px}
#gate h2{margin:0 0 6px;font-size:21px}
#gate p{color:var(--muted);line-height:1.5;margin:8px 0}
#gate input{width:100%;font-family:Consolas,monospace;letter-spacing:.06em;margin-top:10px}
#gate .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
#gate .row a,#gate .row button{flex:1;min-width:140px;text-align:center;text-decoration:none}
#gate .err{color:var(--danger);min-height:18px;margin-top:8px;font-size:13px}
#gate a.btn{display:inline-block}
#gate .fine{font-size:12px;margin-top:16px}
#gate .fine a{color:var(--accent)}
#licBadge{display:none}
#licBadge.on{display:inline-block;margin-left:6px}
#engineNote{display:none;margin:0 0 12px;padding:9px 12px;border:1px solid #6b5424;background:#2a2210;color:#f0c75e;border-radius:5px;font-size:13px}
#engineNote.on{display:block}
"""
html = must_replace(html, '</style>', css + '</style>')

# ---------------------------------------------------------------- overlay HTML
overlay = """<body>
<div id="gate">
  <div class="box">
    <h2 id="gateTitle">Enter your license key</h2>
    <p id="gateMsg">Paste the key from your email to open the app. No account needed.</p>
    <input id="gateKey" type="text" autocomplete="off" spellcheck="false" placeholder="XXXXX-XXXXX-XXXXX-XXXXX">
    <div class="err" id="gateErr"></div>
    <div class="row">
      <button class="btn primary" id="gateGo">Unlock</button>
      <a class="btn" id="gateBuy" href="/checkout">Buy a license</a>
    </div>
    <p class="fine"><a href="/trial">Get a free trial key</a> &middot; <a href="/license/forgot">Lost your key?</a> &middot; <a href="/">Back to site</a></p>
  </div>
</div>
"""
assert html.count('<body>') == 1
html = html.replace('<body>', overlay)

# badge + engine note inside the header / above tabs
html = must_replace(
    html,
    '<div class="badge">ENGINE VALIDATED · 0 COUNTING FAILURES</div>',
    '<div><div class="badge">ENGINE VALIDATED · 0 COUNTING FAILURES</div><div class="badge" id="licBadge"></div></div>',
)
html = must_replace(html, '<div class="tabs">', '<div id="engineNote"></div>\n  <div class="tabs">')

html = must_replace(
    html,
    '<div class="footer">For development/testing use.',
    '<div class="footer"><a href="#" id="changeKey" style="color:inherit">Change license key</a> &middot; For practice, simulation and training use.',
)

# ---------------------------------------------------------------- gate script
gate_js = r"""
<script>
(function(){
  const LS_KEY = 'shoepilot_license_key';
  const $ = id => document.getElementById(id);
  let session = null;      // {token, tokenExpiresAt, license}
  let starting = null;     // in-flight session request
  let deviceHash = null;
  const cache = new Map(); // decision cache so identical questions don't re-hit the server

  const MESSAGES = {
    EXPIRED: ['Your trial has ended', 'This license has expired. Buy a license to keep using the app.'],
    REVOKED: ['License revoked', 'This license is no longer active. Contact support if you think this is a mistake.'],
    NOT_FOUND: ['Key not found', 'We could not find that key. Check it against your email and try again.'],
    DEVICE_LIMIT_REACHED: ['Device limit reached', 'This key is already in use on the maximum number of devices.'],
    TRIAL_ALREADY_USED_ON_DEVICE: ['Trial already used', 'A free trial has already been used on this device. Buy a license to continue.'],
    RATE_LIMITED: ['Too many attempts', 'Please wait a few minutes and try again.'],
    BAD_REQUEST: ['Could not check that key', 'Check the key and try again.'],
    NETWORK: ['Connection problem', 'Could not reach the server. Check your connection and try again.']
  };

  function cyrb53(str){
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
    h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1>>>0)).toString(16).padStart(16, '0');
  }

  // Best-effort device fingerprint. Deliberately avoids things that change often
  // (window size, language, timezone, browser version) so a normal browser update
  // does not look like a new device. It is a speed bump against trial abuse, not
  // an unbreakable lock.
  async function getDeviceHash(){
    if (deviceHash) return deviceHash;
    const parts = [navigator.platform || '', navigator.hardwareConcurrency || '', navigator.deviceMemory || '', screen.colorDepth || ''];
    try {
      const c = document.createElement('canvas'); c.width = 200; c.height = 40;
      const g = c.getContext('2d'); g.textBaseline = 'top'; g.font = '16px Arial'; g.fillText('Shoepilot ♠ fingerprint', 4, 8);
      parts.push(c.toDataURL());
    } catch(e) { parts.push('nocanvas'); }
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      parts.push(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'nogl');
    } catch(e) { parts.push('nogl'); }
    const raw = parts.join('|');
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      deviceHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      deviceHash = (cyrb53(raw) + cyrb53(raw + '1') + cyrb53(raw + '2') + cyrb53(raw + '3'));
    }
    return deviceHash;
  }

  function showGate(reason, opts){
    opts = opts || {};
    const m = MESSAGES[reason];
    $('gateTitle').textContent = m ? m[0] : 'Enter your license key';
    $('gateMsg').textContent = m ? m[1] : 'Paste the key from your email to open the app. No account needed.';
    $('gateErr').textContent = (m && opts.err === m[1]) ? '' : (opts.err || '');
    $('gate').hidden = false;
    $('licBadge').classList.remove('on');
    if (opts.prefill !== undefined) $('gateKey').value = opts.prefill;
  }
  function hideGate(){ $('gate').hidden = true; $('gateErr').textContent = ''; }

  function showBadge(lic){
    const b = $('licBadge');
    if (!lic) { b.classList.remove('on'); return; }
    b.textContent = lic.isTrial
      ? 'TRIAL · ends ' + new Date(lic.expiresAt).toLocaleString()
      : 'LICENSED';
    b.classList.add('on');
  }
  function note(msg){
    const n = $('engineNote');
    if (msg) { n.textContent = msg; n.classList.add('on'); } else { n.classList.remove('on'); }
  }

  async function startSession(key){
    if (starting) return starting;
    starting = (async () => {
      let res, data;
      try {
        res = await fetch('/api/app/session', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ key, deviceHash: await getDeviceHash() })
        });
        data = await res.json();
      } catch(e) { const err = new Error('NETWORK'); err.reason = 'NETWORK'; throw err; }
      if (!res.ok || !data.ok) { const err = new Error(data.reason || 'BAD_REQUEST'); err.reason = data.reason || 'BAD_REQUEST'; throw err; }
      session = data;
      try { localStorage.setItem(LS_KEY, key); } catch(e) {}
      showBadge(data.license);
      return data;
    })();
    try { return await starting; } finally { starting = null; }
  }

  function savedKey(){ try { return localStorage.getItem(LS_KEY) || ''; } catch(e) { return ''; } }

  let lastFail = null; // {at, err}: stops the 250ms refresh loop from hammering the server after a failure
  async function ensureToken(){
    if (session && Date.now() < session.tokenExpiresAt - 60000) return session.token;
    if (lastFail && Date.now() - lastFail.at < 5000) throw lastFail.err;
    const key = savedKey();
    if (!key) { if ($('gate').hidden) showGate(null); const err = new Error('NO_KEY'); err.reason = 'NO_KEY'; throw err; }
    try { await startSession(key); lastFail = null; }
    catch(e) {
      lastFail = { at: Date.now(), err: e };
      if (e.reason && e.reason !== 'NETWORK' && e.reason !== 'RATE_LIMITED') { session = null; showGate(e.reason, {prefill: key}); }
      throw e;
    }
    return session.token;
  }

  async function post(payload, token){
    const res = await fetch('/api/engine/decide', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(Object.assign({}, payload, { token }))
    });
    let data = {};
    try { data = await res.json(); } catch(e) {}
    return { res, data };
  }

  async function decide(payload){
    // While the lock screen is showing, no answers at all (not even cached ones).
    if (!$('gate').hidden) { const e = new Error('LOCKED'); e.reason = 'LOCKED'; throw e; }
    const ck = JSON.stringify(payload);
    if (cache.has(ck)) return cache.get(ck);
    let token = await ensureToken();
    let { res, data } = await post(payload, token);
    if (res.status === 401) { session = null; token = await ensureToken(); ({ res, data } = await post(payload, token)); }
    if (!res.ok || !data.ok) {
      const reason = data.reason || 'ENGINE_ERROR';
      if (reason === 'EXPIRED' || reason === 'REVOKED' || reason === 'NOT_FOUND') { session = null; showGate(reason, {prefill: savedKey()}); }
      else if (reason === 'DAILY_LIMIT') note('Daily decision limit reached for this license. It resets on a rolling 24-hour window.');
      const err = new Error(reason); err.reason = reason; throw err;
    }
    note('');
    if (cache.size > 500) cache.clear();
    cache.set(ck, data.action);
    return data.action;
  }

  async function submitKey(){
    const key = $('gateKey').value.trim().toUpperCase();
    if (!key) { $('gateErr').textContent = 'Enter your key.'; return; }
    $('gateGo').disabled = true; $('gateErr').textContent = '';
    lastFail = null;
    try { await startSession(key); hideGate(); }
    catch(e) {
      const m = MESSAGES[e.reason] || ['', 'Could not verify that key.'];
      showGate(e.reason === 'NETWORK' || e.reason === 'RATE_LIMITED' || e.reason === 'BAD_REQUEST' ? null : e.reason, { err: m[1], prefill: key });
    }
    $('gateGo').disabled = false;
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('gateGo').onclick = submitKey;
    $('gateKey').addEventListener('keydown', e => { if (e.key === 'Enter') submitKey(); });
    $('changeKey').onclick = e => {
      e.preventDefault();
      try { localStorage.removeItem(LS_KEY); } catch(e2) {}
      session = null; cache.clear(); showGate(null, {prefill: ''});
    };
    const key = savedKey();
    if (!key) { showGate(null); return; }
    $('gateKey').value = key;
    startSession(key).then(hideGate).catch(e => {
      if (e.reason === 'NETWORK' || e.reason === 'RATE_LIMITED') showGate(e.reason, {prefill: key});
      else showGate(e.reason, {prefill: key});
    });
  });

  window.__ShoeGate = { decide };
})();
</script>
"""

# gate script goes before the first existing <script>
first_script = html.index('<script>')
html = html[:first_script] + gate_js.lstrip('\n') + html[first_script:]

# ---------------------------------------------------------------- first (UI) script: async decisions
html = must_replace(
    html,
    "  function calcManual(){\n    const p=parseCards($('manualPlayer').value), d=normRank($('manualDealer').value);",
    "  let calcSeq=0, calcTimer=null;\n  function calcManualSoon(){ clearTimeout(calcTimer); calcTimer=setTimeout(calcManual,300); }\n  async function calcManual(){\n    const seq=++calcSeq;\n    const p=parseCards($('manualPlayer').value), d=normRank($('manualDealer').value);",
)
html = must_replace(
    html,
    "      const s=liveState(), a=window.getHi2Decision(p,d,Number(s.trueCount));\n      $('manualDecision').textContent=a;",
    "      const s=liveState(), a=await window.getHi2Decision(p,d,Number(s.trueCount));\n      if(seq!==calcSeq) return;\n      $('manualDecision').textContent=a;",
)
html = must_replace(
    html,
    "    }catch(e){$('manualDecision').textContent='ERROR';$('manualDecisionMeta').textContent=e.message;}",
    "    }catch(e){ if(seq!==calcSeq) return; $('manualDecision').textContent='—';$('manualDecisionMeta').textContent=(e&&e.reason==='NO_KEY')?'Enter your license key to get decisions.':'Decision unavailable: '+(e&&e.message||'error');}",
)
html = must_replace(html, "  function newDrill(){", "  async function newDrill(){")
html = must_replace(
    html,
    "    const a=window.getHi2Decision(p,d,tc);\n    $('trainDealer')",
    "    let a; try{ a=await window.getHi2Decision(p,d,tc); }catch(e){ $('trainResult').style.display='block'; $('trainResult').textContent='Decision unavailable: '+(e&&e.message||'error'); return; }\n    $('trainDealer')",
)
html = must_replace(html, "  function strategyCheck(){", "  async function strategyCheck(){")
html = must_replace(
    html,
    "      const a=window.getHi2Decision(p,d,tc);\n      $('strategyOutput')",
    "      const a=await window.getHi2Decision(p,d,tc);\n      $('strategyOutput')",
)
html = must_replace(
    html,
    "$('manualPlayer').oninput=calcManual;$('manualDealer').oninput=calcManual;",
    "$('manualPlayer').oninput=calcManualSoon;$('manualDealer').oninput=calcManualSoon;",
)

# ---------------------------------------------------------------- second (engine) script
# 1. drop the strategy tables (everything between the Test 28 banner and aceSideAdjustedTC)
html = cut_between(html, "  // Test 28: Hi-Opt II count-aware playing recommendation", "  function aceSideAdjustedTC(){")

# 2. replace hiOptIndexAction with a call to the server
remote = """  // ---- Decisions now come from the server ----
  // The index tables and basic strategy no longer exist in this file. The
  // server re-checks the license on every call, so an expired or revoked key
  // gets no recommendations. See /api/engine/decide.
  function currentRules(){
    return {
      soft17: document.getElementById('strategySoft17').value==='HIT' ? 'HIT' : 'STAND',
      das: document.getElementById('strategyDAS').value==='NO' ? 'NO' : 'YES',
      surrender: document.getElementById('strategySurrender').value==='NONE' ? 'NONE' : 'LATE'
    };
  }
  function remoteDecide(player,dealerUp,tc,mode){
    return window.__ShoeGate.decide({
      mode: mode||'hi2',
      player: player.map(String),
      dealerUp: String(dealerUp).toUpperCase(),
      tc: (Number.isFinite(Number(tc)) ? Math.max(-30, Math.min(30, Math.floor(Number(tc)))) : 0),
      splitOccurred: !!G.splitOccurred,
      rules: currentRules()
    });
  }
  let recSeq=0;
"""
html = cut_between(html, "  function hiOptIndexAction(player,dealerUp,tcOverride=null){", "  function insuranceRecommendation(){", remote)

# 3. updateUI recommendation becomes async
old_rec = "if(G.handActive && player && G.dealerUp && G.dealerUp[0]){ const tc=trueCount(); const action=hiOptIndexAction(player,G.dealerUp[0],tc); const bettingTc=aceSideAdjustedTC(); recEl.textContent=action; metaEl.textContent='Playing TC '+tc.toFixed(2)+' · Ace-adjusted betting TC '+bettingTc.toFixed(2)+(G.dealerUp[0]==='A'?' · Insurance: '+insuranceRecommendation():''); } else { recEl.textContent='—'; metaEl.textContent='No active hand'; }"
new_rec = "if(G.handActive && player && G.dealerUp && G.dealerUp[0]){ const tc=trueCount(); const bettingTc=aceSideAdjustedTC(); const seq=++recSeq; recEl.textContent='…'; metaEl.textContent='Playing TC '+tc.toFixed(2)+' · Ace-adjusted betting TC '+bettingTc.toFixed(2)+(G.dealerUp[0]==='A'?' · Insurance: '+insuranceRecommendation():''); remoteDecide(player.slice(),G.dealerUp[0],tc).then(a=>{ if(seq===recSeq) recEl.textContent=a; }).catch(()=>{ if(seq===recSeq) recEl.textContent='—'; }); } else { recSeq++; recEl.textContent='—'; metaEl.textContent='No active hand'; }"
html = must_replace(html, old_rec, new_rec)

# 4. remove test harnesses + basicStrategy block (smoke tests through runTest29FullShoe)
html = cut_between(html, "  // Lightweight integration smoke tests.", "  // Test 31 diagnostic API")

# 5. fix the public API assignments at the bottom
html = must_replace(html, "  window.recommendStrategy=recommendStrategy;\n  window.runStrategyTests=runStrategyTests;\n", "")
html = must_replace(
    html,
    "  window.getHi2Decision=function(player,dealerUp,tcOverride=null){\n    return hiOptIndexAction(player.map(String),String(dealerUp).toUpperCase(),tcOverride);\n  };",
    "  window.getHi2Decision=function(player,dealerUp,tcOverride=null){\n    return remoteDecide(player,dealerUp,tcOverride===null?trueCount():tcOverride,'hi2');\n  };",
)
html = must_replace(html, "  window.basicStrategy=basicStrategy;\n  window.hiOptIndexAction=hiOptIndexAction;\n", "")
html = must_replace(
    html,
    "recommendation:G.handActive&&G.playerHands[G.active]&&G.dealerUp&&G.dealerUp[0]?hiOptIndexAction(G.playerHands[G.active],G.dealerUp[0],trueCount()):null, ",
    "",
)
html = must_replace(html, "  window.runTest28Integration=runTest28Integration;\n  window.runTest29FullShoe=runTest29FullShoe;\n  runIntegrationSmoke(); updateUI();", "  updateUI();")

# The hidden result containers for the removed test harnesses are no longer needed.
html = must_replace(
    html,
    '<div id="integration1-panel" style="display:none"></div>\n<div id="strategyTests" style="display:none"></div><div id="test28-results" style="display:none"></div><div id="test29-results" style="display:none"></div>',
    '',
)

# sanity: nothing from the engine should remain
for banned in ['HI2_HST', 'HI2_SPT', 'HI2_SDT', 'HI2_HDT', 'function basicStrategy', 'hiOptIndexAction', 'applyHi2Threshold', 'runTest28', 'runTest29', 'runIntegrationSmoke', 'runStrategyTests', 'recommendStrategy']:
    assert banned not in html, f'leftover reference: {banned}'

open(OUT, 'w', encoding='utf-8').write(html)
print('wrote', OUT, len(html), 'bytes')
