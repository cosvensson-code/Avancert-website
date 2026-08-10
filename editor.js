(function () {
  'use strict';

  fetch('/api/me', { credentials: 'include' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (user) { initEditor(user); })
    .catch(function () { /* Ikke logget ind — gør ingenting */ });

  function initEditor(user) {
    var changes = {};
    var originals = {};
    var hasUnsaved = false;

    // Stil for redigerbare elementer og bjælke
    var style = document.createElement('style');
    style.textContent =
      '[data-editable]{transition:outline .15s}' +
      '[data-editable]:hover{outline:2px dashed rgba(254,106,63,.55);outline-offset:3px;cursor:text}' +
      '[data-editable]:focus{outline:2px solid #fe6a3f;outline-offset:3px;background:rgba(254,106,63,.05);border-radius:2px}' +
      '#av-bar{position:fixed;top:0;left:0;right:0;z-index:999999;background:#0c1e28;color:#fff;' +
        'padding:9px 20px;display:flex;align-items:center;justify-content:space-between;' +
        'font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.35)}' +
      '#av-bar .l{display:flex;align-items:center;gap:14px}' +
      '#av-bar .r{display:flex;align-items:center;gap:8px}' +
      '#av-bar button{padding:5px 14px;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700}' +
      '#av-save{background:#fe6a3f;color:#fff}' +
      '#av-save:disabled{background:#555;cursor:default}' +
      '#av-undo{background:rgba(255,255,255,.12);color:#fff}' +
      '#av-logout{background:transparent;color:rgba(255,255,255,.55);' +
        'border:1px solid rgba(255,255,255,.2)!important}' +
      '#av-status{font-size:11px;color:rgba(255,255,255,.65);min-width:200px;text-align:right}';
    document.head.appendChild(style);

    // Giv plads til bjælken og markér editor-tilstand på body
    document.body.style.paddingTop = '44px';
    document.body.classList.add('av-edit');

    // Byg bjælken
    var bar = document.createElement('div');
    bar.id = 'av-bar';
    bar.innerHTML =
      '<div class="l">' +
        '<strong>&#9998; Redigeringstilstand</strong>' +
        '<span>Logget ind som <strong>' + esc(user.name) + '</strong></span>' +
      '</div>' +
      '<div class="r">' +
        '<span id="av-status"></span>' +
        '<button id="av-undo">Fortryd</button>' +
        '<button id="av-save" disabled>Gem ændringer</button>' +
        '<button id="av-logout">Log ud</button>' +
      '</div>';
    document.body.insertBefore(bar, document.body.firstChild);

    var saveBtn   = document.getElementById('av-save');
    var undoBtn   = document.getElementById('av-undo');
    var logoutBtn = document.getElementById('av-logout');
    var statusEl  = document.getElementById('av-status');

    function setStatus(msg) { statusEl.textContent = msg; }
    function updateBar()    { saveBtn.disabled = !Object.keys(changes).length; }

    // Aktiver alle redigerbare elementer
    document.querySelectorAll('[data-editable]').forEach(function (el) {
      var key = el.getAttribute('data-key');
      if (!key) return;
      var isMulti = el.hasAttribute('data-multiline');
      originals[key] = isMulti ? el.textContent.trim() : el.textContent;
      el.contentEditable = 'true';
      el.spellcheck = true;

      // Kun ren tekst ved indsæt (Ctrl+V)
      el.addEventListener('paste', function (e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
      });

      // Enter tillades kun i multiline-felter
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !isMulti) e.preventDefault();
      });

      // Spor ændringer
      el.addEventListener('input', function () {
        var val = isMulti ? el.innerText.trim() : el.textContent.trim();
        if (val !== originals[key]) {
          changes[key] = val;
          hasUnsaved = true;
        } else {
          delete changes[key];
          hasUnsaved = !!Object.keys(changes).length;
        }
        updateBar();
        setStatus('');
      });
    });

    // Gem
    saveBtn.addEventListener('click', function () {
      if (!Object.keys(changes).length) return;
      saveBtn.disabled = true;
      setStatus('Gemmer…');

      var file = window.location.pathname.includes('tilbudsinfo')
        ? 'tilbudsinfo.html' : 'index.html';

      fetch('/api/save', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: file, changes: changes })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) {
            Object.assign(originals, changes);
            changes = {};
            hasUnsaved = false;
            setStatus('✓ Gemt — siden opdateres om 1–2 minutter');
            updateBar();
          } else {
            setStatus('Fejl: ' + (d.error || 'Ukendt fejl'));
            saveBtn.disabled = false;
          }
        })
        .catch(function () {
          setStatus('Fejl: ingen forbindelse');
          saveBtn.disabled = false;
        });
    });

    // Fortryd
    undoBtn.addEventListener('click', function () {
      if (!hasUnsaved) return;
      if (!confirm('Fortryd alle ugemte ændringer?')) return;
      document.querySelectorAll('[data-editable]').forEach(function (el) {
        var key = el.getAttribute('data-key');
        if (key && originals[key] !== undefined) {
          if (el.hasAttribute('data-multiline')) {
            el.innerText = originals[key];
          } else {
            el.textContent = originals[key];
          }
        }
      });
      changes = {};
      hasUnsaved = false;
      setStatus('');
      updateBar();
    });

    // Log ud
    logoutBtn.addEventListener('click', function () {
      fetch('/api/logout', { method: 'POST', credentials: 'include' })
        .finally(function () { location.reload(); });
    });

    // Billedredigering: klik på foto for at skifte det ud
    var imgStyle = document.createElement('style');
    imgStyle.textContent =
      '.av-img-wrap{position:relative;display:block}' +
      '.av-img-overlay{position:absolute;inset:0;background:rgba(0,0,0,.52);color:#fff;' +
        'display:flex;align-items:center;justify-content:center;cursor:pointer;' +
        'font-size:.78rem;font-weight:700;letter-spacing:.02em;opacity:0;' +
        'transition:opacity .2s;border-radius:inherit;gap:.35rem}' +
      '.av-img-wrap:hover .av-img-overlay{opacity:1}' +
      '.av-img-overlay.uploading{opacity:1;background:rgba(0,0,0,.7)}';
    document.head.appendChild(imgStyle);

    document.querySelectorAll('[data-editable-img]').forEach(function (img) {
      var key = img.getAttribute('data-key');
      if (!key) return;

      // Wrap img in a relative container
      var parent = img.parentElement;
      var wrap = document.createElement('span');
      wrap.className = 'av-img-wrap';
      parent.insertBefore(wrap, img);
      wrap.appendChild(img);

      var overlay = document.createElement('span');
      overlay.className = 'av-img-overlay';
      overlay.innerHTML = '&#128247; Skift billede';
      wrap.appendChild(overlay);

      overlay.addEventListener('click', function (e) {
        e.stopPropagation();
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function () {
          var file = input.files[0];
          if (!file) return;
          overlay.classList.add('uploading');
          overlay.textContent = 'Behandler…';

          // Resize via canvas (max 1400px, JPEG 88%)
          // createImageBitmap med imageOrientation:'from-image' retter EXIF-rotation
          var safeName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          // createImageBitmap med imageOrientation:'from-image' retter EXIF-rotation automatisk
          createImageBitmap(file, { imageOrientation: 'from-image' })
          .then(function (bitmap) {
            var MAX = 1400;
            var w = bitmap.width, h = bitmap.height;
            if (w > MAX || h > MAX) {
              if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
              else        { w = Math.round(w * MAX / h); h = MAX; }
            }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
            var b64 = canvas.toDataURL('image/jpeg', 0.88).split(',')[1];

            overlay.textContent = 'Uploader…';
            return fetch('/api/upload', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: safeName, data: b64 })
            }).then(function (r) { return r.json(); });
          })
          .then(function (d) {
            if (d && d.ok) {
              img.src = d.path;
              changes[key] = d.path;
              hasUnsaved = true;
              updateBar();
              setStatus('Billede klar — tryk Gem for at publicere');
            } else {
              setStatus('Upload fejlede: ' + (d && d.error ? d.error : 'ukendt'));
            }
            overlay.classList.remove('uploading');
            overlay.innerHTML = '&#128247; Skift billede';
          })
          .catch(function () {
            setStatus('Upload fejlede — tjek forbindelsen');
            overlay.classList.remove('uploading');
            overlay.innerHTML = '&#128247; Skift billede';
          });
        };
        input.click();
      });
    });

    // Advar ved ugemte ændringer
    window.addEventListener('beforeunload', function (e) {
      if (hasUnsaved) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
})();
