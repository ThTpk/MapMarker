/* ui.js — แถบข้าง: รายการที่วาด, ปุ่มเครื่องมือ, จานสี, ค้นหาสถานที่, โหมดมือถือ */
(function () {
  var App = window.App, map = App.map;
  var $ = function (id) { return document.getElementById(id); };
  var isMobile = function () { return window.matchMedia('(max-width: 820px)').matches; };

  /* ---------- รายการที่วาด ---------- */
  App.render = function () {
    var list = $('feature-list');
    var n = App.features.size;
    list.innerHTML = '';

    var totalLen = 0, totalArea = 0;

    App.features.forEach(function (f) {
      var k = Measure.kind(f.layer);
      var raw = Measure.raw(f.layer);
      if (k === 'line') totalLen += raw.length;
      // วงแหวนชุดเดียวกันซ้อนทับกัน การบวกพื้นที่รวมจึงไม่มีความหมาย
      if (!f.ring) totalArea += raw.area;

      var li = document.createElement('li');
      if (!f.visible) li.className = 'hidden-feat';

      var dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = f.color;

      var info = document.createElement('span');
      info.className = 'info';
      info.title = f.note || f.name;
      info.innerHTML =
        '<span class="name">' + App.shapeIcon(f.shape) + ' ' + App.esc(f.name) + '</span>' +
        '<span class="meta">' + App.esc(Measure.summary(f.layer)) + '</span>';
      info.addEventListener('click', function () { App.zoomTo(f.id); });

      var acts = document.createElement('span');
      acts.className = 'acts';

      var vis = document.createElement('button');
      vis.type = 'button';
      vis.innerHTML = f.visible ? '👁' : '🚫';
      vis.title = f.visible ? 'ซ่อนชิ้นนี้' : 'แสดงชิ้นนี้';
      vis.addEventListener('click', function () { App.setVisible(f.id, !f.visible); });

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'del';
      del.innerHTML = '✕';
      del.title = 'ลบชิ้นนี้';
      del.addEventListener('click', function () { App.removeFeature(f.id, { undo: true }); });

      acts.appendChild(vis);
      acts.appendChild(del);
      li.appendChild(dot);
      li.appendChild(info);
      li.appendChild(acts);
      list.appendChild(li);
    });

    $('count').textContent = n;
    $('empty').hidden = n > 0;
    $('btn-clear').hidden = n === 0;
    $('btn-undo').disabled = n === 0;

    var parts = [];
    if (totalLen > 0) parts.push('ความยาวเส้นรวม <b>' + Measure.fmtDist(totalLen) + '</b>');
    if (totalArea > 0) parts.push('พื้นที่รวม <b>' + Measure.fmtArea(totalArea) + '</b>');
    $('totals').innerHTML = parts.join(' · ');
  };

  /* ---------- ปุ่มเครื่องมือ ---------- */
  $('tools').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    App.setMode(btn.getAttribute('data-mode'));
    if (isMobile()) document.body.classList.add('side-closed');
  });

  $('btn-drag-toggle').addEventListener('click', function () {
    App.setDragAllowed(!App.dragAllowed);
    $('hint').innerHTML = App.dragAllowed
      ? 'เปิดการย้ายแล้ว — ลากรูปที่วาดไว้เพื่อย้ายตำแหน่งได้เลย'
      : 'ล็อกตำแหน่งแล้ว — ลากรูปไม่ได้ กดปุ่ม "ย้ายได้" อีกครั้งเพื่อปลดล็อก';
  });

  $('btn-undo').addEventListener('click', function () { App.undoLast(); });

  $('btn-clear').addEventListener('click', function () {
    if (confirm('ลบทุกชิ้นที่วาดไว้ ' + App.features.size + ' รายการ? การลบนี้ย้อนคืนไม่ได้')) App.clearAll();
  });

  /* ---------- อ่านพิกัดที่พิมพ์: "13.7563, 100.5018" ---------- */
  function parseLatLng(text) {
    var m = String(text || '').trim()
      .match(/^(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
    if (!m) return null;
    var lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return L.latLng(lat, lng);
  }
  function fmtLL(ll) { return ll.lat.toFixed(5) + ', ' + ll.lng.toFixed(5); }

  /* ---------- ระบุรัศมี + จุดศูนย์กลาง ตอนวาดวงกลม / สี่เหลี่ยม ---------- */
  var fixedEl = $('fixed-km');
  var centerEl = $('center-ll');

  App.fixedSize = function () { return parseFloat(fixedEl.value); };
  fixedEl.addEventListener('input', function () { App.refreshMode(); });

  // เมื่อวางด้วยการคลิก ให้เติมพิกัดที่ใช้ลงช่อง เพื่อให้เห็น/ทำซ้ำได้
  App.noteCenter = function (ll) { centerEl.value = fmtLL(ll); };

  $('btn-place-center').addEventListener('click', function () {
    var ll = parseLatLng(centerEl.value);
    if (!ll) { alert('กรอกพิกัดจุดศูนย์กลางในรูปแบบ  13.7563, 100.5018'); centerEl.focus(); return; }
    if (!(App.fixedSize() > 0)) { alert('กรอกรัศมีเป็นกิโลเมตรก่อน'); fixedEl.focus(); return; }
    var shape = (App.getMode() === 'Rectangle') ? 'Rectangle' : 'Circle';
    App.placeFixedAt(ll, shape, { pan: true });
    if (isMobile()) document.body.classList.add('side-closed');
  });

  /* ---------- เปิด/ปิดจุดศูนย์กลางของวงกลมทุกวง ---------- */
  $('show-centers').addEventListener('change', function () {
    App.setAllCenterDots(this.checked);
    map.closePopup();   // ป็อปอัปที่เปิดอยู่จะได้ไม่ค้างค่าเก่า
  });

  /* ---------- ชุดวงแหวนรัศมี ---------- */
  var profileEl = $('ring-profile');
  var customEl = $('ring-custom');

  function parseKms(text) {
    return String(text || '')
      .split(/[,\s]+/)
      .map(function (s) { return parseFloat(s); })
      .filter(function (n) { return isFinite(n) && n > 0; });
  }

  /** draw.js เรียกใช้ตอนวางวงแหวน */
  App.ringConfig = function () {
    var v = profileEl.value;
    return {
      kms: v === 'custom' ? parseKms(customEl.value) : parseKms(v),
      centerMarker: $('ring-center').checked
    };
  };

  profileEl.addEventListener('change', function () {
    customEl.hidden = this.value !== 'custom';
    if (!customEl.hidden) customEl.focus();
  });

  $('btn-ring-click').addEventListener('click', function () {
    if (!App.ringConfig().kms.length) { alert('ใส่รัศมีอย่างน้อย 1 ค่า (หน่วยกิโลเมตร)'); return; }
    App.setMode('rings');
    if (isMobile()) document.body.classList.add('side-closed');
  });

  App.noteRingCenter = function (ll) { $('ring-center-ll').value = fmtLL(ll); };

  $('btn-ring-center').addEventListener('click', function () {
    var cfg = App.ringConfig();
    if (!cfg.kms.length) { alert('ใส่รัศมีอย่างน้อย 1 ค่า (หน่วยกิโลเมตร)'); return; }
    var txt = $('ring-center-ll').value.trim();
    var ll = txt ? parseLatLng(txt) : map.getCenter();
    if (!ll) { alert('พิกัดจุดศูนย์กลางต้องอยู่ในรูปแบบ  13.7563, 100.5018'); $('ring-center-ll').focus(); return; }
    App.setMode(null);
    App.addRings(ll, cfg.kms, { centerMarker: cfg.centerMarker });
    App.noteRingCenter(ll);
    if (isMobile()) document.body.classList.add('side-closed');
  });

  /* ---------- จานสี ---------- */
  var colorsEl = $('colors');
  App.colors.forEach(function (c) {
    var b = document.createElement('button');
    b.type = 'button';
    b.style.background = c;
    b.title = 'ใช้สีนี้กับชิ้นที่วาดต่อไป';
    b.setAttribute('aria-label', 'เลือกสี ' + c);
    if (c === App.activeColor) b.className = 'active';
    b.addEventListener('click', function () {
      App.setActiveColor(c);
      colorsEl.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
    });
    colorsEl.appendChild(b);
  });

  /* ---------- ค้นหาสถานที่ / พิกัด ---------- */
  var resultsEl = $('search-results');
  var hitMarker = null;

  function showResults(items) {
    resultsEl.innerHTML = '';
    resultsEl.hidden = false;
    items.forEach(function (it) {
      var li = document.createElement('li');
      if (it.state) {
        li.className = 'state';
        li.textContent = it.state;
      } else {
        li.innerHTML = '<span>' + App.esc(it.title) + '</span><small>' + App.esc(it.sub) + '</small>';
        li.addEventListener('click', function () { goTo(it); });
      }
      resultsEl.appendChild(li);
    });
  }

  function goTo(it) {
    if (it.bounds) map.fitBounds(it.bounds, { maxZoom: 17 });
    else map.flyTo([it.lat, it.lng], Math.max(map.getZoom(), 16));
    if (hitMarker) map.removeLayer(hitMarker);
    hitMarker = L.circleMarker([it.lat, it.lng], {
      radius: 9, color: '#e11d48', weight: 3, fillOpacity: 0, interactive: false
    }).addTo(map);
    resultsEl.hidden = true;
    if (isMobile()) document.body.classList.add('side-closed');
  }

  $('search-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('search-input').value.trim();
    if (!q) { resultsEl.hidden = true; return; }

    // พิมพ์พิกัดตรง ๆ: 13.7563, 100.5018
    var m = q.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
    if (m) {
      var lat = parseFloat(m[1]), lng = parseFloat(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        goTo({ lat: lat, lng: lng });
        return;
      }
    }

    showResults([{ state: 'กำลังค้นหา…' }]);
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=th&q=' +
      encodeURIComponent(q);

    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        if (!data.length) { showResults([{ state: 'ไม่พบสถานที่ที่ตรงกับคำค้นนี้' }]); return; }
        showResults(data.map(function (d) {
          var name = d.display_name || '';
          var bb = d.boundingbox;
          return {
            title: name.split(',')[0],
            sub: name,
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
            bounds: bb ? [[parseFloat(bb[0]), parseFloat(bb[2])], [parseFloat(bb[1]), parseFloat(bb[3])]] : null
          };
        }));
      })
      .catch(function () {
        showResults([{ state: 'ค้นหาไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง' }]);
      });
  });

  /* ---------- คีย์ลัด ---------- */
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'Escape') { App.setMode(null); map.closePopup(); }
    else if (e.key === 'f' || e.key === 'F') App.toggleFullscreen();
    else if ((e.key === 'h' || e.key === 'H') && !isMobile()) App.toggleWide();
  });

  /* ---------- แผงเครื่องมือบนมือถือ ---------- */
  $('btn-collapse').addEventListener('click', function () {
    document.body.classList.add('side-closed');
  });
  $('btn-open').addEventListener('click', function () {
    document.body.classList.remove('side-closed');
  });
  if (isMobile()) document.body.classList.add('side-closed');

  App.render();
})();
