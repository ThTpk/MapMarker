/* measure.js — คำนวณและจัดรูปแบบระยะทาง / พื้นที่ (หน่วยเมตริก + ไร่-ตร.วา) */
window.Measure = (function () {
  var R = 6378137; // รัศมีโลก (เมตร, WGS84)

  function nf(n, d) {
    return n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  /** ระยะทางเป็นข้อความ */
  function fmtDist(m) {
    if (m < 1000) return nf(m, m < 100 ? 1 : 0) + ' ม.';
    return nf(m / 1000, m < 100000 ? 2 : 1) + ' กม.';
  }

  /** พื้นที่เป็นข้อความ พร้อมหน่วยไทยในวงเล็บ */
  function fmtArea(a) {
    var main = a < 1e6 ? nf(a, a < 1000 ? 1 : 0) + ' ตร.ม.' : nf(a / 1e6, 2) + ' ตร.กม.';
    var sub = a >= 1600 ? nf(a / 1600, 2) + ' ไร่' : nf(a / 4, 1) + ' ตร.วา';
    return main + ' (' + sub + ')';
  }

  function fmtLatLng(ll) {
    return ll.lat.toFixed(6) + ', ' + ll.lng.toFixed(6);
  }

  /** เอาวงแหวนนอกสุดของ polygon / รายการจุดของ polyline */
  function ring(layer) {
    var ll = layer.getLatLngs();
    while (Array.isArray(ll) && Array.isArray(ll[0])) ll = ll[0];
    return ll || [];
  }

  function pathLength(latlngs, close) {
    var total = 0;
    for (var i = 1; i < latlngs.length; i++) total += latlngs[i - 1].distanceTo(latlngs[i]);
    if (close && latlngs.length > 2) total += latlngs[latlngs.length - 1].distanceTo(latlngs[0]);
    return total;
  }

  /** พื้นที่บนทรงกลม (spherical excess) — แม่นกว่าการคิดแบบระนาบ */
  function geodesicArea(latlngs) {
    var n = latlngs.length, d2r = Math.PI / 180, area = 0, p1, p2;
    if (n < 3) return 0;
    for (var i = 0; i < n; i++) {
      p1 = latlngs[i];
      p2 = latlngs[(i + 1) % n];
      area += ((p2.lng - p1.lng) * d2r) * (2 + Math.sin(p1.lat * d2r) + Math.sin(p2.lat * d2r));
    }
    return Math.abs(area * R * R / 2);
  }

  function kind(layer) {
    if (layer instanceof L.Circle) return 'circle';
    if (layer instanceof L.Polygon) return 'polygon';
    if (layer instanceof L.Polyline) return 'line';
    return 'point';
  }

  /** ค่าดิบ สำหรับรวมยอดในแถบล่าง */
  function raw(layer) {
    var k = kind(layer), out = { length: 0, area: 0 };
    if (k === 'line') out.length = pathLength(ring(layer), false);
    else if (k === 'polygon') { var r = ring(layer); out.area = geodesicArea(r); out.length = pathLength(r, true); }
    else if (k === 'circle') { var rad = layer.getRadius(); out.area = Math.PI * rad * rad; }
    return out;
  }

  /** รายละเอียดสำหรับ popup: [[หัวข้อ, ค่า], ...] */
  function rows(layer) {
    var k = kind(layer);
    if (k === 'point') {
      return [['พิกัด', fmtLatLng(layer.getLatLng())]];
    }
    if (k === 'circle') {
      var rad = layer.getRadius();
      return [
        ['รัศมี', fmtDist(rad)],
        ['พื้นที่', fmtArea(Math.PI * rad * rad)],
        ['จุดศูนย์กลาง', fmtLatLng(layer.getLatLng())]
      ];
    }
    var pts = ring(layer);
    if (k === 'polygon') {
      return [
        ['พื้นที่', fmtArea(geodesicArea(pts))],
        ['เส้นรอบรูป', fmtDist(pathLength(pts, true))],
        ['จำนวนจุด', pts.length + ' จุด']
      ];
    }
    return [
      ['ระยะทาง', fmtDist(pathLength(pts, false))],
      ['จำนวนจุด', pts.length + ' จุด']
    ];
  }

  /** สรุปบรรทัดเดียว สำหรับรายการใน sidebar */
  function summary(layer) {
    var k = kind(layer);
    if (k === 'point') return fmtLatLng(layer.getLatLng());
    if (k === 'circle') return 'รัศมี ' + fmtDist(layer.getRadius());
    var pts = ring(layer);
    if (k === 'polygon') return 'พื้นที่ ' + fmtArea(geodesicArea(pts));
    return 'ระยะทาง ' + fmtDist(pathLength(pts, false));
  }

  return {
    kind: kind, raw: raw, rows: rows, summary: summary,
    fmtDist: fmtDist, fmtArea: fmtArea, fmtLatLng: fmtLatLng
  };
})();
