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
      totalArea += raw.area;

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
      del.addEventListener('click', function () { App.removeFeature(f.id); });

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

  $('btn-undo').addEventListener('click', function () { App.undoLast(); });

  $('btn-clear').addEventListener('click', function () {
    if (confirm('ลบทุกชิ้นที่วาดไว้ ' + App.features.size + ' รายการ? การลบนี้ย้อนคืนไม่ได้')) App.clearAll();
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
