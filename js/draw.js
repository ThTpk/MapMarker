/* draw.js — เครื่องมือวาด/แก้ไข (Leaflet-Geoman), ทะเบียนรูปที่วาด, ฟอร์มใน popup */
(function () {
  var App = window.App, map = App.map;

  App.render = App.render || function () {};

  var COLORS = ['#e11d48', '#f97316', '#eab308', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#111827'];
  App.colors = COLORS;
  App.activeColor = '#2563eb';

  App.dragAllowed = true;   // ลากย้ายรูปที่วาดได้ตลอด (ปิดได้จากปุ่ม "ย้ายได้")

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
      f.layer.setStyle({
        color: f.color,
        weight: f.ring ? 2 : 3,
        fillColor: f.color,
        fillOpacity: f.ring ? 0.05 : 0.18   // วงแหวนซ้อนกันหลายวง ต้องโปร่งกว่าปกติ
      });
    }
    syncLabel(f);
  }

  /* ---------- ป้ายบอกรัศมีของวงกลม ---------- */
  function km3(m) { return Math.round(m / 1000 * 1000) / 1000; }

  /** ข้อความสั้นบนป้าย: 5 กม., 7.33 กม., 800 ม. */
  function ringText(m) {
    return m >= 1000 ? (Math.round(m / 10) / 100) + ' กม.' : Math.round(m) + ' ม.';
  }

  function northPoint(circle) {
    var c = circle.getLatLng();
    return L.latLng(c.lat + (circle.getRadius() / 6378137) * (180 / Math.PI), c.lng);
  }

  function syncLabel(f) {
    if (Measure.kind(f.layer) !== 'circle') return;
    var icon = L.divIcon({
      className: 'ring-label',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      html: '<span class="ring-chip" style="border-color:' + f.color + ';color:' + f.color + '">' +
        esc(ringText(f.layer.getRadius())) + '</span>'
    });
    if (!f.labelLayer) {
      f.labelLayer = L.marker(northPoint(f.layer), { icon: icon, interactive: false, keyboard: false });
      if (f.visible) App.drawnItems.addLayer(f.labelLayer);
    } else {
      f.labelLayer.setLatLng(northPoint(f.layer));
      f.labelLayer.setIcon(icon);
    }
  }

  /* ---------- ลากย้ายรูปที่วาด ---------- */
  function applyDrag(f) {
    if (!f.layer.pm || !f.layer.pm.enableLayerDrag) return;
    var on = App.dragAllowed && f.visible && mode !== 'remove';
    try {
      if (on) f.layer.pm.enableLayerDrag();
      else f.layer.pm.disableLayerDrag();
    } catch (err) {}
  }

  App.syncDrag = function () { App.features.forEach(applyDrag); };

  App.setDragAllowed = function (on) {
    App.dragAllowed = !!on;
    App.syncDrag();
    var btn = document.getElementById('btn-drag-toggle');
    if (btn) btn.classList.toggle('active', App.dragAllowed);
  };

  /* ย้ายทั้งชุด: ลากวงไหนของชุดวงแหวน วงอื่นกับหมุดศูนย์กลางตามไปด้วย */
  var groupDrag = null;

  function centerOf(layer) {
    return layer.getLatLng ? layer.getLatLng() : layer.getBounds().getCenter();
  }

  function groupMembers(f) {
    var list = [];
    if (!f.groupId) return list;
    App.features.forEach(function (o) {
      if (o.groupId === f.groupId && o.id !== f.id && o.layer.setLatLng) list.push(o);
    });
    return list;
  }

  function onGroupDragStart(f) {
    var members = groupMembers(f);
    if (!members.length) { groupDrag = null; return; }
    groupDrag = {
      origin: centerOf(f.layer),
      members: members.map(function (o) { return { f: o, at: o.layer.getLatLng() }; })
    };
  }

  function onGroupDrag(f) {
    if (!groupDrag) return;
    var now = centerOf(f.layer);
    var dLat = now.lat - groupDrag.origin.lat;
    var dLng = now.lng - groupDrag.origin.lng;
    groupDrag.members.forEach(function (m) {
      m.f.layer.setLatLng(L.latLng(m.at.lat + dLat, m.at.lng + dLng));
      syncLabel(m.f);
    });
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
      (Measure.kind(f.layer) === 'circle'
        ? '<label>รัศมี (กิโลเมตร)</label>' +
          '<input type="number" class="p-radius" min="0.01" step="0.5" value="' + km3(f.layer.getRadius()) + '">'
        : '') +
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
    var rad = pop.querySelector('.p-radius');
    if (rad) rad.addEventListener('input', function () {
      var km = parseFloat(this.value);
      if (!isFinite(km) || km <= 0) return;
      f.layer.setRadius(km * 1000);
      syncLabel(f);
      refreshOpenPopup(f);
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
    var pop = document.querySelector('.pop[data-id="' + f.id + '"]');
    if (!pop) return;
    var box = pop.querySelector('.measure');
    if (box) box.innerHTML = measureHtml(f);
    var rad = pop.querySelector('.p-radius');
    if (rad && document.activeElement !== rad) rad.value = km3(f.layer.getRadius());
  }

  /* ---------- ทะเบียนรูปที่วาด ---------- */
  function addFeature(layer, shape, opts) {
    opts = opts || {};
    shape = shape || 'Marker';
    var name = opts.name;
    if (!name) {
      if (seq[shape] == null) seq[shape] = 0;
      seq[shape]++;
      name = (LABELS[shape] || 'รูปที่') + ' ' + seq[shape];
    }
    uid++;
    var f = {
      id: 'f' + uid,
      layer: layer,
      shape: shape,
      name: name,
      note: '',
      color: opts.color || App.activeColor,
      visible: true,
      ring: !!opts.ring,
      groupId: opts.groupId || null,
      labelLayer: null
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
      syncLabel(f);
      refreshOpenPopup(f);
      App.render();
    });
    layer.on('pm:dragstart', function () { onGroupDragStart(f); });
    layer.on('pm:drag', function () { onGroupDrag(f); });
    layer.on('pm:dragend', function () { onGroupDrag(f); groupDrag = null; App.render(); });
    layer.on('pm:remove', function () { App.removeFeature(f.id); });

    applyDrag(f);
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
    if (f.labelLayer) {
      App.drawnItems.removeLayer(f.labelLayer);
      if (map.hasLayer(f.labelLayer)) map.removeLayer(f.labelLayer);
      f.labelLayer = null;
    }
    if (App.drawnItems.hasLayer(f.layer)) App.drawnItems.removeLayer(f.layer);
    if (map.hasLayer(f.layer)) map.removeLayer(f.layer);
    dropFeature(id);
  };

  App.clearAll = function () {
    Array.from(App.features.keys()).forEach(App.removeFeature);
    Object.keys(seq).forEach(function (k) { seq[k] = 0; });
    ringGroup = 0;
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
    if (f.labelLayer) {
      if (visible) App.drawnItems.addLayer(f.labelLayer);
      else App.drawnItems.removeLayer(f.labelLayer);
    }
    applyDrag(f);
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

  /* ---------- ชุดวงแหวนรัศมี (วงกลมซ้อนกันหลายวง) ---------- */
  var ringGroup = 0;

  App.addRings = function (center, kms, opts) {
    opts = opts || {};
    kms = (kms || [])
      .map(Number)
      .filter(function (k) { return isFinite(k) && k > 0; })
      .sort(function (a, b) { return a - b; });
    if (!kms.length) return [];

    ringGroup++;
    var groupName = 'วงแหวน ' + ringGroup;
    var groupId = 'g' + ringGroup;
    var color = App.activeColor;
    var made = [];

    // วาดวงใหญ่ก่อน วงเล็กจะได้อยู่ชั้นบนและคลิกเลือกได้
    kms.slice().reverse().forEach(function (km) {
      var c = L.circle(center, { radius: km * 1000 });
      c.addTo(map);
      made.push(addFeature(c, 'Circle', {
        name: groupName + ' · ' + km + ' กม.', color: color, ring: true, groupId: groupId
      }));
    });

    if (opts.centerMarker) {
      var m = L.marker(center);
      m.addTo(map);
      made.push(addFeature(m, 'Marker', {
        name: 'ศูนย์กลาง ' + groupName, color: color, groupId: groupId
      }));
    }

    var maxR = kms[kms.length - 1] * 1000;
    map.fitBounds(L.latLng(center).toBounds(maxR * 2.4), { maxZoom: 16 });
    return made;
  };

  /** วางชุดวงแหวนกลางจอ */
  App.addRingsAtCenter = function (kms, opts) {
    return App.addRings(map.getCenter(), kms, opts);
  };

  /* ---------- โหมดเครื่องมือ ---------- */
  var HINTS = {
    Marker: 'คลิกบนแผนที่เพื่อปักหมุด (ปักต่อเนื่องได้)',
    Line: 'คลิกไล่จุดเพื่อวาดเส้น · คลิกจุดสุดท้ายซ้ำเพื่อจบ',
    Polygon: 'คลิกไล่จุด · คลิกจุดแรกเพื่อปิดรูปและคิดพื้นที่',
    Rectangle: 'คลิกมุมหนึ่ง แล้วคลิกมุมตรงข้าม',
    Circle: 'คลิกจุดศูนย์กลาง แล้วคลิกเพื่อกำหนดรัศมี',
    edit: 'คลิกรูปที่ต้องการแก้ แล้วลากจุดสีขาวเพื่อปรับรูปทรง',
    remove: 'คลิกรูปที่ต้องการลบ',
    rings: 'คลิกบนแผนที่เพื่อวางจุดศูนย์กลางของชุดวงแหวน'
  };
  var DEFAULT_HINT = 'ลากรูปที่วาดไว้เพื่อย้ายตำแหน่งได้เลย · เลือกเครื่องมือแล้วคลิกบนแผนที่เพื่อวาดใหม่ · กด <kbd>Esc</kbd> เพื่อยกเลิก';

  var mode = null;
  // ปิดเฉพาะโหมดที่เปิดอยู่ (ถ้าสั่งปิดโหมดที่ไม่ได้เปิด Geoman จะขึ้น warning ใน console)
  function disableAll() {
    if (map.pm.globalDrawModeEnabled()) map.pm.disableDraw();
    if (map.pm.globalEditModeEnabled()) map.pm.disableGlobalEditMode();
    if (map.pm.globalDragModeEnabled()) map.pm.disableGlobalDragMode();
    if (map.pm.globalRemovalModeEnabled()) map.pm.disableGlobalRemovalMode();
  }

  /** โหมดวงกลม/สี่เหลี่ยมแบบระบุขนาด: คลิกจุดศูนย์กลาง 1 ครั้งได้ขนาดตามที่กรอก */
  var fixedShape = null;

  function fixedKm() {
    var km = App.fixedSize ? App.fixedSize() : 0;
    return (isFinite(km) && km > 0) ? km : 0;
  }

  function onFixedClick(e) {
    var km = fixedKm();
    if (!km) return;
    var layer = (fixedShape === 'Circle')
      ? L.circle(e.latlng, { radius: km * 1000 })
      : L.rectangle(L.latLng(e.latlng).toBounds(km * 2000));  // จัตุรัส ครึ่งด้าน = รัศมี
    layer.addTo(map);
    addFeature(layer, fixedShape);
  }

  /** โหมด "วางวงแหวน": คลิกครั้งเดียวแล้วออกจากโหมด */
  function onRingClick(e) {
    var cfg = (App.ringConfig && App.ringConfig()) || {};
    App.setMode(null);
    App.addRings(e.latlng, cfg.kms, { centerMarker: cfg.centerMarker });
  }

  App.setMode = function (next) {
    disableAll();
    map.off('click', onRingClick);
    map.off('click', onFixedClick);
    fixedShape = null;
    mode = (next === mode) ? null : next;

    var km = fixedKm();
    if (mode === 'edit') map.pm.enableGlobalEditMode();
    else if (mode === 'remove') map.pm.enableGlobalRemovalMode();
    else if (mode === 'rings') map.on('click', onRingClick);
    else if (km && (mode === 'Circle' || mode === 'Rectangle')) {
      fixedShape = mode;                 // ระบุขนาดไว้แล้ว → คลิกจุดเดียวพอ
      map.on('click', onFixedClick);
    } else if (mode) map.pm.enableDraw(mode);

    map.getContainer().style.cursor = (mode === 'rings' || fixedShape) ? 'crosshair' : '';

    document.querySelectorAll('[data-mode]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });

    var hint = mode ? HINTS[mode] : DEFAULT_HINT;
    if (fixedShape) {
      hint = 'คลิกบนแผนที่เพื่อวาง' +
        (fixedShape === 'Circle' ? 'วงกลมรัศมี ' : 'สี่เหลี่ยมจัตุรัสครึ่งด้าน ') +
        km + ' กม. (คลิกซ้ำวางได้หลายจุด)';
    }
    document.getElementById('hint').innerHTML = hint;
    App.syncDrag();   // โหมดลบ: ปิดการลากชั่วคราว กันลบผิดชิ้น
  };

  /** เรียกเมื่อค่ารัศมีที่กรอกเปลี่ยน เพื่อสลับระหว่างวาดเอง / ระบุขนาด */
  App.refreshMode = function () {
    var m = mode;
    if (m === 'Circle' || m === 'Rectangle') { App.setMode(null); App.setMode(m); }
  };
  App.getMode = function () { return mode; };
})();
