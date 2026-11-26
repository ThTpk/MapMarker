/* draw.js — เครื่องมือวาด/แก้ไข (Leaflet-Geoman), ทะเบียนรูปที่วาด, ฟอร์มใน popup */
(function () {
  var App = window.App, map = App.map;

  App.render = App.render || function () {};

  var COLORS = ['#e11d48', '#f97316', '#eab308', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#111827'];
  App.colors = COLORS;
  App.activeColor = '#2563eb';

  var seq = { Marker: 0, Line: 0, Polygon: 0, Rectangle: 0, Circle: 0 };
  var uid = 0;
  var order = [];         // ลำดับการสร้าง (ใช้กับปุ่มย้อน)

  /* ---------- ไอคอนหมุดแบบเปลี่ยนสีได้ ---------- */
  function pinIcon(color) {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 26 38" width="26" height="38">' +
      '<path d="M12 0C5.37 0 0 5.37 0 12c0 8.2 10.3 22.2 11 23.2.3.4.8.4 1.1 0C12.7 34.2 24 20.2 24 12 24 5.37 18.63 0 12 0z" ' +
      'fill="' + color + '" stroke="#ffffff" stroke-width="1.6"/>' +
      '<circle cx="12" cy="12" r="4.4" fill="#ffffff"/></svg>';
    return L.divIcon({
      html: svg, className: 'pin-icon',
      iconSize: [26, 38], iconAnchor: [13, 37], popupAnchor: [0, -32]
    });
  }

  /* ---------- ตั้งค่า Geoman ---------- */
  map.pm.setLang('th', {
    tooltips: {
      placeMarker: 'คลิกเพื่อวางจุด',
      firstVertex: 'คลิกเพื่อเริ่มวาด',
      continueLine: 'คลิกเพื่อต่อเส้น',
      finishLine: 'คลิกจุดเดิมอีกครั้งเพื่อจบเส้น',
      finishPoly: 'คลิกจุดแรกเพื่อปิดรูป',
      finishRect: 'คลิกเพื่อจบสี่เหลี่ยม',
      startCircle: 'คลิกเพื่อกำหนดจุดศูนย์กลาง',
      finishCircle: 'คลิกเพื่อกำหนดรัศมี',
      placeCircleMarker: 'คลิกเพื่อวางวงกลมเล็ก'
    },
    actions: { finish: 'เสร็จสิ้น', cancel: 'ยกเลิก', removeLastVertex: 'ลบจุดสุดท้าย' }
  }, 'en');

  function applyGlobalOptions() {
    var c = App.activeColor;
    map.pm.setGlobalOptions({
      continueDrawing: true,
      snappable: true,
      snapDistance: 18,
      markerStyle: { icon: pinIcon(c) },
      templineStyle: { color: c, weight: 3 },
      hintlineStyle: { color: c, weight: 2, dashArray: '5,6' },
      pathOptions: { color: c, weight: 3, fillColor: c, fillOpacity: 0.18 }
    });
  }
  applyGlobalOptions();

  /* ---------- สไตล์ตามชนิดรูป ---------- */
  function applyStyle(f) {
    var k = Measure.kind(f.layer);
    if (k === 'point') {
      if (f.layer.setIcon) f.layer.setIcon(pinIcon(f.color));
    } else if (k === 'line') {
      f.layer.setStyle({ color: f.color, weight: 4, opacity: 0.95 });
    } else {
      f.layer.setStyle({ color: f.color, weight: 3, fillColor: f.color, fillOpacity: 0.18 });
    }
  }

  var LABELS = { Marker: 'จุดที่', Line: 'เส้นที่', Polygon: 'พื้นที่', Rectangle: 'สี่เหลี่ยมที่', Circle: 'วงกลมที่' };
  var ICONS = { Marker: '📍', Line: '⟋', Polygon: '⬠', Rectangle: '▭', Circle: '◯' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  App.esc = esc;
  App.shapeIcon = function (shape) { return ICONS[shape] || '•'; };

  /* ---------- popup: ฟอร์มแก้ไขรายละเอียด ---------- */
  function measureHtml(f) {
    return Measure.rows(f.layer).map(function (r) {
      return '<div>' + r[0] + ': <b>' + esc(r[1]) + '</b></div>';
    }).join('');
  }

  function popupHtml(f) {
    return '<div class="pop" data-id="' + f.id + '">' +
      '<label>ชื่อ</label>' +
      '<input type="text" class="p-name" maxlength="80" value="' + esc(f.name) + '">' +
      '<label>รายละเอียด</label>' +
      '<textarea class="p-note" rows="2" placeholder="โน้ตเพิ่มเติม">' + esc(f.note) + '</textarea>' +
      '<div class="measure">' + measureHtml(f) + '</div>' +
      '<label>สี</label><div class="pop-colors">' +
      COLORS.map(function (c) {
        return '<button type="button" data-color="' + c + '" class="' +
          (c === f.color ? 'active' : '') + '" style="background:' + c + '" aria-label="สี ' + c + '"></button>';
      }).join('') + '</div>' +
      '<div class="pop-foot">' +
      '<button type="button" class="zoom">ซูมไปที่นี่</button>' +
      '<button type="button" class="del">ลบชิ้นนี้</button>' +
      '</div></div>';
  }

  map.on('popupopen', function (e) {
    var el = e.popup.getElement();
    if (!el) return;
    var pop = el.querySelector('.pop');
    if (!pop) return;
    var f = App.features.get(pop.getAttribute('data-id'));
    if (!f) return;

    L.DomEvent.disableClickPropagation(pop);
    L.DomEvent.on(pop, 'keydown', L.DomEvent.stopPropagation);

    pop.querySelector('.p-name').addEventListener('input', function () {
      f.name = this.value;
      App.render();
    });
    pop.querySelector('.p-note').addEventListener('input', function () {
      f.note = this.value;
      App.render();
    });
    pop.querySelectorAll('.pop-colors button').forEach(function (b) {
      b.addEventListener('click', function () {
        App.setColor(f.id, this.getAttribute('data-color'));
        pop.querySelectorAll('.pop-colors button').forEach(function (x) { x.classList.remove('active'); });
        this.classList.add('active');
      });
    });
    pop.querySelector('.zoom').addEventListener('click', function () {
      map.closePopup();
      App.zoomTo(f.id);
    });
    pop.querySelector('.del').addEventListener('click', function () {
      map.closePopup();
      App.removeFeature(f.id);
    });
  });

  /* อัปเดตเฉพาะกล่องค่าวัด ถ้า popup เปิดอยู่ (ไม่รีเซ็ตช่องที่กำลังพิมพ์) */
  function refreshOpenPopup(f) {
    var box = document.querySelector('.pop[data-id="' + f.id + '"] .measure');
    if (box) box.innerHTML = measureHtml(f);
  }

  /* ---------- ทะเบียนรูปที่วาด ---------- */
  function addFeature(layer, shape) {
    shape = shape || 'Marker';
    if (seq[shape] == null) seq[shape] = 0;
    seq[shape]++;
    uid++;
    var f = {
      id: 'f' + uid,
      layer: layer,
      shape: shape,
      name: (LABELS[shape] || 'รูปที่') + ' ' + seq[shape],
      note: '',
      color: App.activeColor,
      visible: true
    };
    App.features.set(f.id, f);
    order.push(f.id);

    App.drawnItems.addLayer(layer);
    applyStyle(f);
    layer.bindPopup(function () { return popupHtml(f); }, { minWidth: 240, autoPan: true });

    var CHANGE_EVENTS = [
      'pm:edit', 'pm:update', 'pm:change', 'pm:drag', 'pm:dragend',
      'pm:markerdrag', 'pm:markerdragend', 'pm:vertexadded', 'pm:vertexremoved',
      'pm:rotate', 'pm:rotateend', 'pm:cut'
    ].join(' ');
    layer.on(CHANGE_EVENTS, function () {
      refreshOpenPopup(f);
      App.render();
    });
    layer.on('pm:remove', function () { App.removeFeature(f.id); });

    App.render();
    return f;
  }

  function dropFeature(id) {
    var f = App.features.get(id);
    if (!f) return;
    App.features.delete(id);
    order = order.filter(function (x) { return x !== id; });
    App.render();
  }

  map.on('pm:create', function (e) { addFeature(e.layer, e.shape); });

  /* ---------- API ที่ sidebar เรียกใช้ ---------- */
  App.removeFeature = function (id) {
    var f = App.features.get(id);
    if (!f) return;
    // ปิดโหมดแก้ไขของชิ้นนี้ก่อน ไม่งั้นจุดจับ (vertex) จะค้างบนแผนที่
    try { if (f.layer.pm && f.layer.pm.enabled && f.layer.pm.enabled()) f.layer.pm.disable(); } catch (err) {}
    if (App.drawnItems.hasLayer(f.layer)) App.drawnItems.removeLayer(f.layer);
    if (map.hasLayer(f.layer)) map.removeLayer(f.layer);
    dropFeature(id);
  };

  App.clearAll = function () {
    Array.from(App.features.keys()).forEach(App.removeFeature);
    Object.keys(seq).forEach(function (k) { seq[k] = 0; });
  };

  App.undoLast = function () {
    if (!order.length) return;
    App.removeFeature(order[order.length - 1]);
  };

  App.setColor = function (id, color) {
    var f = App.features.get(id);
    if (!f) return;
    f.color = color;
    applyStyle(f);
    App.render();
  };

  App.setVisible = function (id, visible) {
    var f = App.features.get(id);
    if (!f) return;
    f.visible = visible;
    if (visible) App.drawnItems.addLayer(f.layer);
    else App.drawnItems.removeLayer(f.layer);
    App.render();
  };

  App.zoomTo = function (id) {
    var f = App.features.get(id);
    if (!f) return;
    if (!f.visible) App.setVisible(id, true);
    if (f.layer.getBounds) map.fitBounds(f.layer.getBounds().pad(0.25), { maxZoom: 18 });
    else map.flyTo(f.layer.getLatLng(), Math.max(map.getZoom(), 16));
    f.layer.openPopup();
  };

  App.setActiveColor = function (c) {
    App.activeColor = c;
    applyGlobalOptions();
  };

  /* ---------- โหมดเครื่องมือ ---------- */
  var HINTS = {
    Marker: 'คลิกบนแผนที่เพื่อปักหมุด (ปักต่อเนื่องได้)',
    Line: 'คลิกไล่จุดเพื่อวาดเส้น · คลิกจุดสุดท้ายซ้ำเพื่อจบ',
    Polygon: 'คลิกไล่จุด · คลิกจุดแรกเพื่อปิดรูปและคิดพื้นที่',
    Rectangle: 'คลิกมุมหนึ่ง แล้วคลิกมุมตรงข้าม',
    Circle: 'คลิกจุดศูนย์กลาง แล้วคลิกเพื่อกำหนดรัศมี',
    edit: 'คลิกรูปที่ต้องการแก้ แล้วลากจุดสีขาวเพื่อปรับรูปทรง',
    drag: 'ลากรูปทั้งชิ้นเพื่อย้ายตำแหน่ง',
    remove: 'คลิกรูปที่ต้องการลบ'
  };
  var DEFAULT_HINT = 'เลือกเครื่องมือ แล้วคลิกบนแผนที่ · กด <kbd>Esc</kbd> เพื่อยกเลิก';

  var mode = null;
  function disableAll() {
    map.pm.disableDraw();
    map.pm.disableGlobalEditMode();
    map.pm.disableGlobalDragMode();
    map.pm.disableGlobalRemovalMode();
  }

  App.setMode = function (next) {
    disableAll();
    mode = (next === mode) ? null : next;

    if (mode === 'edit') map.pm.enableGlobalEditMode();
    else if (mode === 'drag') map.pm.enableGlobalDragMode();
    else if (mode === 'remove') map.pm.enableGlobalRemovalMode();
    else if (mode) map.pm.enableDraw(mode);

    document.querySelectorAll('#tools button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
    document.getElementById('hint').innerHTML = mode ? HINTS[mode] : DEFAULT_HINT;
  };
  App.getMode = function () { return mode; };
})();
