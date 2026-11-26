/* map.js — สร้างแผนที่, แผนที่พื้นหลัง, พิกัดเมาส์, ตำแหน่งฉัน, ธีม, URL แชร์ */
window.App = (function () {
  var DEFAULT = { lat: 13.7563, lng: 100.5018, zoom: 12 }; // กรุงเทพฯ

  var BASEMAPS = [
    {
      id: 'osm', name: 'OpenStreetMap',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      opts: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }
    },
    {
      id: 'light', name: 'สว่าง (เรียบ)',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      opts: { maxZoom: 19, maxNativeZoom: 16, attribution: 'Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors' }
    },
    {
      id: 'dark', name: 'มืด (เรียบ)',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      opts: { maxZoom: 19, maxNativeZoom: 16, attribution: 'Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors' }
    },
    {
      id: 'sat', name: 'ภาพถ่ายดาวเทียม (Esri)',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      opts: { maxZoom: 19, attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics' }
    },
    {
      id: 'topo', name: 'ภูมิประเทศ (OpenTopoMap)',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      opts: { maxZoom: 17, subdomains: 'abc', attribution: '&copy; OpenStreetMap, SRTM | &copy; OpenTopoMap (CC-BY-SA)' }
    }
  ];

  /* ---------- ตำแหน่งเริ่มต้นจาก URL (#lat,lng,zoom) ---------- */
  function readHash() {
    var m = (location.hash || '').replace('#', '').split(',');
    var lat = parseFloat(m[0]), lng = parseFloat(m[1]), z = parseInt(m[2], 10);
    if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat: lat, lng: lng, zoom: isFinite(z) ? z : 15 };
    }
    return DEFAULT;
  }

  var start = readHash();
  var map = L.map('map', {
    center: [start.lat, start.lng],
    zoom: start.zoom,
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: true
  });
  map.zoomControl.setPosition('bottomright');

  var layers = {};
  BASEMAPS.forEach(function (b) { layers[b.id] = L.tileLayer(b.url, b.opts); });

  var currentBase = null;
  function setBasemap(id) {
    if (!layers[id] || currentBase === id) return;
    if (currentBase) map.removeLayer(layers[currentBase]);
    layers[id].addTo(map).bringToBack();
    currentBase = id;
    var sel = document.getElementById('basemap');
    if (sel && sel.value !== id) sel.value = id;
  }

  /* กลุ่มเก็บทุกรูปที่วาด */
  var drawnItems = L.featureGroup().addTo(map);

  L.control.scale({ metric: true, imperial: false, position: 'bottomright' }).addTo(map);

  /* ---------- พิกัดเมาส์ ---------- */
  var coordsEl = document.getElementById('coords');
  function showCoords(ll, z) {
    coordsEl.textContent = ll.lat.toFixed(5) + ', ' + ll.lng.toFixed(5) + '  ·  z' + z;
  }
  map.on('mousemove', function (e) { showCoords(e.latlng, map.getZoom()); });
  map.on('mouseout', function () { showCoords(map.getCenter(), map.getZoom()); });
  showCoords(map.getCenter(), map.getZoom());

  /* ---------- อัปเดต URL ให้แชร์ตำแหน่งได้ ---------- */
  var hashTimer = null;
  map.on('moveend zoomend', function () {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(function () {
      var c = map.getCenter();
      history.replaceState(null, '', '#' + c.lat.toFixed(5) + ',' + c.lng.toFixed(5) + ',' + map.getZoom());
    }, 400);
  });

  /* ---------- ปุ่มตำแหน่งฉัน ---------- */
  var meMarker = null;
  document.getElementById('btn-locate').addEventListener('click', function () {
    if (!navigator.geolocation) { alert('เบราว์เซอร์นี้ไม่รองรับการหาตำแหน่ง'); return; }
    var btn = this;
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false;
      var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      if (meMarker) map.removeLayer(meMarker);
      meMarker = L.circleMarker(ll, {
        radius: 7, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1, interactive: false
      }).addTo(map);
      map.flyTo(ll, Math.max(map.getZoom(), 16));
    }, function () {
      btn.disabled = false;
      alert('หาตำแหน่งไม่ได้ — ต้องอนุญาตการเข้าถึงตำแหน่ง และเปิดผ่าน https หรือ localhost');
    }, { enableHighAccuracy: true, timeout: 10000 });
  });

  /* ---------- ธีมสว่าง / มืด ---------- */
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    // ถ้าใช้คู่แผนที่ Carto อยู่ ให้สลับให้เข้ากับธีมด้วย
    if (t === 'dark' && currentBase === 'light') setBasemap('dark');
    else if (t === 'light' && currentBase === 'dark') setBasemap('light');
  }
  setTheme(prefersDark ? 'dark' : 'light');
  document.getElementById('btn-theme').addEventListener('click', function () {
    var now = document.documentElement.getAttribute('data-theme');
    setTheme(now === 'dark' ? 'light' : 'dark');
  });

  /* ---------- ตัวเลือกแผนที่พื้นหลัง ---------- */
  var sel = document.getElementById('basemap');
  BASEMAPS.forEach(function (b) {
    var o = document.createElement('option');
    o.value = b.id; o.textContent = b.name;
    sel.appendChild(o);
  });
  sel.addEventListener('change', function () { setBasemap(this.value); });
  setBasemap(prefersDark ? 'dark' : 'osm');

  return {
    map: map,
    drawnItems: drawnItems,
    basemaps: BASEMAPS,
    setBasemap: setBasemap,
    features: new Map()   // id -> { id, layer, shape, name, note, color, visible }
  };
})();
