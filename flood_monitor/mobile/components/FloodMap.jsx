import { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import LUMBAN_GEOJSON from '../assets/lumban-adm4.json';
import LUMBAN_BORDER from '../assets/lumban-border.json';

const LUMBAN_CENTER = { lat: 14.291969, lng: 121.460112 };

const RISK_CFG = {
  VERY_HIGH: { color: '#b91c1c', fill: '#ef4444', label: 'Very High Risk', tagalog: 'Napakataas na Panganib', icon: '🔴', desc: 'Mataas na tsansa ng pagbaha. Maaring kailangang mag-evacuate.' },
  HIGH: { color: '#c2410c', fill: '#f97316', label: 'High Risk', tagalog: 'Mataas na Panganib', icon: '🟠', desc: 'Prone sa pagbaha lalo na tuwing malakas ang ulan.' },
  MODERATE: { color: '#a16207', fill: '#eab308', label: 'Moderate Risk', tagalog: 'Katamtamang Panganib', icon: '🟡', desc: 'May posibilidad ng pagbaha sa ilang lugar.' },
  LOW: { color: '#15803d', fill: '#22c55e', label: 'Low Risk', tagalog: 'Mababang Panganib', icon: '🟢', desc: 'Mababang panganib ng pagbaha sa lugar na ito.' },
  DEFAULT: { color: '#2980b9', fill: '#2980b9', label: 'No Data', tagalog: 'Walang datos', icon: '⚪', desc: 'Walang datos.' },
};

const BRGY_CENTERS = {
  'Bagong Silang': [14.2951, 121.4648],
  'Balimbingan (Pob.)': [14.3002, 121.4603],
  'Balubad': [14.2766, 121.4779],
  'Caliraya': [14.2968, 121.5562],
  'Concepcion': [14.2986, 121.4540],
  'Lewin': [14.3025, 121.5155],
  'Maracta (Pob.)': [14.2985, 121.4597],
  'Maytalang I': [14.2884, 121.4583],
  'Maytalang II': [14.2968, 121.4345],
  'Primera Parang (Pob.)': [14.2924, 121.4613],
  'Primera Pulo (Pob.)': [14.3013, 121.4601],
  'Salac (Pob.)': [14.2954, 121.4607],
  'Segunda Parang (Pob.)': [14.2942, 121.4607],
  'Segunda Pulo (Pob.)': [14.3031, 121.4607],
  'Santo Niño (Pob.)': [14.2969, 121.4597],
  'Wawa': [14.3281, 121.4418],
};

export function FloodRiskMap({ height = 400, areas = [], userLocation = null }) {
  const [loading, setLoading] = useState(true);

  const riskMap = {};
  (areas || []).forEach(a => { riskMap[a.name] = a.risk_level; });

  const userMarkerJS = userLocation
    ? `L.marker([${userLocation.lat},${userLocation.lng}],{
        icon:L.divIcon({
          html:'<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 5px rgba(37,99,235,0.3);"></div>',
          className:'',iconSize:[16,16],iconAnchor:[8,8]
        }),
        zIndexOffset:500
      }).addTo(map).bindPopup('<div style="font-size:13px"><b>\uD83D\uDCCD Your Location</b></div>');`
    : '';

  const html = `<!DOCTYPE html><html><head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{height:100%;width:100%;background:#b8d4e8;touch-action:none}
    .leaflet-popup-content-wrapper{background:#0f172a;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#e2e8f0;box-shadow:0 8px 32px rgba(0,0,0,0.7);padding:0}
    .leaflet-popup-content{margin:0}
    .leaflet-popup-tip{background:#0f172a}
    .ui{background:rgba(255,255,255,0.94);border:1px solid rgba(0,0,0,0.13);border-radius:10px;padding:8px 11px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.13)}
  </style>
  </head><body><div id="map"></div><script>
    var RISK_CFG = ${JSON.stringify(RISK_CFG)};
    var riskMap  = ${JSON.stringify(riskMap)};
    var BRGY_CENTERS = ${JSON.stringify(BRGY_CENTERS)};

    function getRisk(name) {
      var level = riskMap[name];
      return level ? RISK_CFG[level] : RISK_CFG.DEFAULT;
    }

    var map = L.map('map',{zoomControl:false}).setView([${LUMBAN_CENTER.lat},${LUMBAN_CENTER.lng}],12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{attribution:'\u00a9 CARTO',maxZoom:19}).addTo(map);

    window.loadGeoJSON = function(geojsonStr) {
      var geojson = JSON.parse(geojsonStr);
      L.geoJSON(geojson, {
        style: function(feature) {
          var cfg = getRisk(feature.properties.ADM4_EN);
          return { color: '#ffffff', weight: 2, fillColor: cfg.fill, fillOpacity: 0.5 };
        },
        onEachFeature: function(feature, layer) {
          var name = feature.properties.ADM4_EN;
          var cfg  = getRisk(name);
          layer.on('click', function(){ this.setStyle({fillOpacity:0.85,weight:3}); this.bringToFront(); });
          layer.bindPopup(
            '<div style="min-width:195px;background:#0f172a;color:#e2e8f0;border-radius:10px;padding:13px;border-left:4px solid '+cfg.fill+'">'+
            '<div style="font-weight:800;font-size:14px;color:'+cfg.fill+';margin-bottom:3px">'+name+'</div>'+
            '<div style="font-size:10px;color:#64748b;margin-bottom:8px">Lumban, Laguna</div>'+
            '<span style="background:'+cfg.fill+'33;color:'+cfg.fill+';padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid '+cfg.fill+'">'+cfg.icon+' '+cfg.label+'</span>'+
            '<div style="margin-top:8px;font-size:11px;color:#94a3b8;line-height:1.5">'+cfg.desc+'</div>'+
            '</div>'
          );
        }
      }).addTo(map);

      Object.keys(BRGY_CENTERS).forEach(function(name) {
        var pos = BRGY_CENTERS[name];
        L.marker(pos, {
          icon: L.divIcon({
            html: '<div style="color:#1a1a2e;font-size:8px;font-weight:800;white-space:nowrap;text-shadow:0 0 3px #fff,0 0 6px #fff,0 0 9px #fff;font-family:sans-serif;pointer-events:none;transform:translate(-50%,-50%)">'+name+'</div>',
            className:'', iconAnchor:[0,0],
          }),
          interactive:false, zIndexOffset:300,
        }).addTo(map);
      });
    };

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',{attribution:'',maxZoom:19,opacity:0.5}).addTo(map);

    L.marker([${LUMBAN_CENTER.lat},${LUMBAN_CENTER.lng}],{
      icon:L.divIcon({html:'<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#1d4ed8,#60a5fa);border:2px solid #fff;box-shadow:0 0 16px rgba(59,130,246,0.9);display:flex;align-items:center;justify-content:center;font-size:13px;">\uD83D\uDCF7</div>',className:'',iconSize:[30,30],iconAnchor:[15,15]}),
    }).addTo(map).bindPopup('<div style="background:#0f172a;color:#e2e8f0;padding:10px;border-radius:10px;border-left:4px solid #3b82f6"><b style="color:#60a5fa">\uD83D\uDCF7 CAM-LUMBAN-01</b><br/><span style="color:#64748b;font-size:11px">Lumban Bridge \u2014 Active</span></div>');

    ${userMarkerJS}

    var badge=L.control({position:'topleft'});
    badge.onAdd=function(){var d=L.DomUtil.create('div','ui');d.innerHTML='<div style="color:#dc2626;font-size:11px;font-weight:800">\u26A0\uFE0F FLOOD RISK MAP</div><div style="color:#64748b;font-size:9px;margin-top:2px">Lumban, Laguna \u2022 Tap barangay for details</div>';return d;};
    badge.addTo(map);

    var legend=L.control({position:'bottomright'});
    legend.onAdd=function(){
      var d=L.DomUtil.create('div','ui');
      d.innerHTML='<div style="font-size:9px;font-weight:700;color:#64748b;margin-bottom:7px;text-transform:uppercase;letter-spacing:1px">Risk Level</div>'+
        [['#ef4444','Very High'],['#f97316','High'],['#eab308','Moderate'],['#22c55e','Low'],['#2980b9','No Data']].map(function(r){
          return '<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px"><div style="width:16px;height:11px;background:'+r[0]+';border:1.5px solid #fff;border-radius:2px;opacity:0.7"></div><span style="color:#1e293b;font-size:10px;font-weight:600">'+r[1]+'</span></div>';
        }).join('')+
        ${userLocation ? `'<div style="display:flex;align-items:center;gap:7px;margin-top:4px;padding-top:6px;border-top:1px solid #dde"><div style="width:12px;height:12px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,0.3);flex-shrink:0"></div><span style="color:#1e293b;font-size:10px;font-weight:600">You</span></div>'` : `''`};
      return d;
    };
    legend.addTo(map);
  </script></body></html>`;

  const geojsonInject = `(function(){
    var s=${JSON.stringify(JSON.stringify(LUMBAN_GEOJSON))};
    if(window.loadGeoJSON) window.loadGeoJSON(s);
    else document.addEventListener('DOMContentLoaded',function(){window.loadGeoJSON(s);});
  })(); true;`;

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color="#f97316" size="large" />
        </View>
      )}
      <WebView
        source={{ html }}
        style={{ flex: 1 }}
        onLoad={() => setLoading(false)}
        injectedJavaScript={geojsonInject}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        nestedScrollEnabled
        originWhitelist={['*']}
      />
    </View>
  );
}

export function EvacuationMap({ centers = [], height = 400, userLocation = null }) {
  const [loading, setLoading] = useState(true);

  const borderJS = JSON.stringify(LUMBAN_BORDER);

  const markersJS = centers.map(c => `
    L.marker([${c.lat},${c.lng}],{
      icon:L.divIcon({
        html:'<div style="width:32px;height:32px;border-radius:8px;background:${c.is_open ? '#16a34a' : '#6b7280'};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:15px;">\uD83C\uDFE0</div>',
        className:'',iconSize:[32,32],iconAnchor:[16,32],
      }),
    }).addTo(map).bindPopup(
      '<div style="min-width:200px;font-size:13px;line-height:1.6">'+
      '<strong style="font-size:14px">${c.name}</strong><br/>'+
      '\uD83D\uDCCD ${c.barangay_name || ''}<br/>'+
      ${c.address ? `'${c.address}<br/>'+` : ''}
      '\uD83D\uDC65 ${c.capacity_current} / ${c.capacity_total}<br/>'+
      ${c.contact_person ? `'\uD83D\uDC64 ${c.contact_person}<br/>'+` : ''}
      ${c.contact_number ? `'\uD83D\uDCDE ${c.contact_number}<br/>'+` : ''}
      '<span style="background:${c.is_open ? '#dcfce7' : '#f3f4f6'};color:${c.is_open ? '#16a34a' : '#6b7280'};padding:2px 10px;border-radius:999px;font-size:11px;font-weight:bold">${c.is_open ? '\u2713 OPEN' : '\u2717 CLOSED'}</span>'+
      '</div>',
      {maxWidth:280}
    );
  `).join('\n');

  const userMarkerJS = userLocation
    ? `L.marker([${userLocation.lat},${userLocation.lng}],{
        icon:L.divIcon({
          html:'<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 5px rgba(37,99,235,0.3);"></div>',
          className:'',iconSize:[16,16],iconAnchor:[8,8]
        }),
        zIndexOffset:500
      }).addTo(map).bindPopup('<div style="font-size:13px"><b>\uD83D\uDCCD Your Location</b></div>');`
    : '';

  const html = `<!DOCTYPE html><html><head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{height:100%;width:100%;background:#f2efe9;touch-action:none}
  </style>
  </head><body><div id="map"></div><script>
    var map=L.map('map',{zoomControl:true}).setView([${LUMBAN_CENTER.lat},${LUMBAN_CENTER.lng}],15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'\u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom:19
    }).addTo(map);

    var border = ${borderJS};
    L.geoJSON(border,{style:{color:'#ef4444',weight:3,fillOpacity:0,dashArray:'6 3'},interactive:false}).addTo(map);

    L.marker([${LUMBAN_CENTER.lat},${LUMBAN_CENTER.lng}],{
      icon:L.divIcon({
        html:'<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#1d4ed8,#60a5fa);border:2px solid #fff;box-shadow:0 0 16px rgba(59,130,246,0.9);display:flex;align-items:center;justify-content:center;font-size:13px;">\uD83D\uDCF7</div>',
        className:'',iconSize:[30,30],iconAnchor:[15,15]
      })
    }).addTo(map).bindPopup('<div style="min-width:200px;font-size:13px;line-height:1.6"><strong style="font-size:14px">\uD83D\uDCF7 CAM-LUMBAN-01</strong><br/>Lumban Bridge<br/><span style="color:#16a34a;font-weight:bold">\u25CF Active Monitoring</span></div>');

    ${userMarkerJS}
    ${markersJS}
  </script></body></html>`;

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color="#22c55e" size="large" />
        </View>
      )}
      <WebView
        source={{ html }}
        style={{ flex: 1 }}
        onLoad={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        nestedScrollEnabled
        originWhitelist={['*']}
      />
    </View>
  );
}

const RESPONDER_ROLE_CFG = {
  PNP: { color: '#1d4ed8', emoji: '\uD83D\uDC6E' },
  PNP: { color: '#1d4ed8', emoji: '👮' },
  BFP: { color: '#ea580c', emoji: '🚒' },
  RHU: { color: '#16a34a', emoji: '🏥' },
  MDRRMO: { color: '#dc2626', emoji: '🛡️' },
  MDRRMO_RESPONDER: { color: '#dc2626', emoji: '🛡️' },
  BARANGAY_OFFICIAL: { color: '#7e22ce', emoji: '🏢' },
  RESCUE: { color: '#0ea5e9', emoji: '⛑️' },
};

export function SOSTrackingMap({ sosLocation = null, responders = [], assignedResponders = [], assignedRescueId = null, height = 320 }) {
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const center = sosLocation
    ? { lat: sosLocation.lat, lng: sosLocation.lng }
    : LUMBAN_CENTER;

  const sosMarkerJS = sosLocation
    ? `
      var sosIcon = L.divIcon({
        html: '<div style="position:relative;width:48px;height:48px;"><div style="position:absolute;top:0;left:0;width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.3);animation:pulse 1.2s ease-out infinite;"></div><div style="position:absolute;top:8px;left:8px;width:32px;height:32px;border-radius:50%;background:rgba(239,68,68,0.5);animation:pulse 1.2s ease-out infinite 0.2s;"></div><div style="position:absolute;top:14px;left:14px;width:20px;height:20px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 0 8px rgba(239,68,68,0.9);display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;">🆘</div></div>',
        className:'custom-div-icon', iconSize:[48,48], iconAnchor:[24,24]
      });
      L.marker([${sosLocation.lat},${sosLocation.lng}], { icon: sosIcon, zIndexOffset: 800 })
        .addTo(map)
        .bindPopup('<div style="font-size:13px;font-weight:700;color:#dc2626">🆘 Your SOS Location</div>');
    `
    : '';

  const navigationLinesArr = [];
  if (sosLocation && sosLocation.lat && sosLocation.lng) {
    const assignedIds = new Set();
    if (Array.isArray(assignedResponders)) {
      assignedResponders.forEach(dr => { if (dr.responder_id) assignedIds.add(String(dr.responder_id)); });
    }
    if (assignedRescueId) assignedIds.add(String(assignedRescueId));

    if (assignedIds.size > 0) {
      responders.forEach(r => {
        if (r.last_lat && r.last_lng && assignedIds.has(String(r.id))) {
          const matchDr = Array.isArray(assignedResponders) ? assignedResponders.find(dr => String(dr.responder_id) === String(r.id)) : null;
          const isBackup = matchDr?.dispatch_type === 'BACKUP';
          const lineCol = isBackup ? '#f59e0b' : '#dc2626';
          const dashArr = isBackup ? '8, 8' : '10, 10';
          navigationLinesArr.push(`
            L.polyline([[${r.last_lat}, ${r.last_lng}], [${sosLocation.lat}, ${sosLocation.lng}]], {
              color: '${lineCol}',
              weight: 5,
              opacity: 0.95,
              dashArray: '${dashArr}',
              lineCap: 'round'
            }).addTo(map);
          `);
        }
      });
    }
  }

  const responderMarkersJS = responders.map(r => {
    const cfg = RESPONDER_ROLE_CFG[r.role] || { color: '#64748b', emoji: '👤' };
    const time = r.last_location_at ? new Date(r.last_location_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Live';
    const fullNameClean = (r.full_name || 'Responder').replace(/'/g, "\\'");
    const isAssigned = (Array.isArray(assignedResponders) && assignedResponders.some(dr => dr.responder_id === r.id)) || r.id === assignedRescueId;
    const matchDr = Array.isArray(assignedResponders) ? assignedResponders.find(dr => dr.responder_id === r.id) : null;
    const isBackup = matchDr?.dispatch_type === 'BACKUP';
    const assignedBadge = isAssigned ? `<span style="background:${isBackup ? '#fef3c7' : '#fee2e2'};color:${isBackup ? '#b45309' : '#dc2626'};padding:1px 6px;border-radius:999px;font-size:10px;font-weight:800;border:1px solid ${isBackup ? '#fcd34d' : '#fca5a5'}">🚨 ${isBackup ? 'BACKUP RESCUE' : 'PRIMARY RESCUE'}</span><br/>` : '';

    return `
      L.marker([${r.last_lat},${r.last_lng}],{
        icon:L.divIcon({
          html:'<div style="width:38px;height:38px;border-radius:50%;background:${cfg.color};border:3px solid white;box-shadow:0 0 0 3px ${cfg.color}55,0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:18px;">${cfg.emoji}</div>',
          className:'custom-div-icon',iconSize:[38,38],iconAnchor:[19,19]
        }),zIndexOffset:${isAssigned ? 700 : 400}
      }).addTo(map).bindPopup(
        '<div style="min-width:160px;font-size:13px;line-height:1.6">'+
        '<b style="color:${cfg.color};font-size:14px">${fullNameClean}</b><br/>'+
        '${assignedBadge}'+
        '<span style="background:${cfg.color}22;color:${cfg.color};padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid ${cfg.color}">${r.role}</span><br/>'+
        '<span style="color:#64748b;font-size:11px">📍 Updated: ${time}</span>'+
        '</div>'
      );
    `;
  }).join('\n');

  const boundsPoints = [];
  if (sosLocation && sosLocation.lat && sosLocation.lng) boundsPoints.push([sosLocation.lat, sosLocation.lng]);
  responders.forEach(r => { if (r.last_lat && r.last_lng) boundsPoints.push([r.last_lat, r.last_lng]); });

  let fitBoundsJS = `map.setView([${center.lat},${center.lng}], 15);`;
  if (boundsPoints.length > 1) {
    const pointsJSON = JSON.stringify(boundsPoints);
    fitBoundsJS = `var bounds = L.latLngBounds(${pointsJSON}); map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });`;
  }

  const html = `<!DOCTYPE html><html><head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{height:100%;width:100%;background:#f2efe9;touch-action:none}
    .leaflet-marker-icon, .leaflet-marker-shadow{position:absolute !important;}
    @keyframes pulse{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.2);opacity:0}}
  </style>
  </head><body><div id="map"></div><script>
    var map=L.map('map',{zoomControl:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
    ${sosMarkerJS}
    ${responderMarkersJS}
    ${navigationLinesArr.join('\n')}
    ${fitBoundsJS}
  </script></html>`;

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color="#ef4444" size="large" />
        </View>
      )}
      <WebView
        source={{ html }}
        style={{ flex: 1 }}
        onLoad={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        nestedScrollEnabled
        originWhitelist={['*']}
      />
      <TouchableOpacity
        style={styles.fullScreenOverlayBtn}
        onPress={() => setIsFullScreen(true)}
        activeOpacity={0.85}>
        <Ionicons name="expand" size={13} color="#ffffff" />
        <Text style={styles.fullScreenOverlayText}>Full-Screen</Text>
      </TouchableOpacity>
      <Modal visible={isFullScreen} animationType="slide" hardwareAccelerated onRequestClose={() => setIsFullScreen(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>🆘 Resident Rescue Tracking Map</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsFullScreen(false)}>
              <Ionicons name="close-circle" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <WebView source={{ html }} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled />
        </View>
      </Modal>
    </View>
  );
}

export function ResponderMap({ responders = [], sosList = [], height = 320, currentUser = null, userLocation = null }) {
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const myLoc = userLocation || (currentUser?.last_lat && currentUser?.last_lng ? { lat: currentUser.last_lat, lng: currentUser.last_lng } : null);

  const activeAssignedSOS = sosList.find(s => {
    if (!currentUser?.id) return false;
    const isAssigned = s.assigned_rescue_id === currentUser.id || (s.dispatched_responders && s.dispatched_responders.some(dr => dr.responder_id === currentUser.id));
    return isAssigned && ['DISPATCHED', 'RESPONDING'].includes(s.status);
  });

  const currentUserMarkerJS = myLoc
    ? `
      L.marker([${myLoc.lat},${myLoc.lng}],{
        icon:L.divIcon({
          html:'<div style="position:relative;width:44px;height:44px;"><div style="position:absolute;top:0;left:0;width:44px;height:44px;border-radius:50%;background:rgba(37,99,235,0.35);animation:pulse 1.2s ease-out infinite;"></div><div style="position:absolute;top:6px;left:6px;width:32px;height:32px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 12px rgba(37,99,235,0.9);display:flex;align-items:center;justify-content:center;font-size:16px;">📍</div></div>',
          className:'custom-div-icon',iconSize:[44,44],iconAnchor:[22,22]
        }),zIndexOffset:900
      }).addTo(map).bindPopup(
        '<div style="min-width:160px;font-size:13px;line-height:1.6">'+
        '<b style="color:#2563eb">📍 YOUR LOCATION (You)</b><br/>'+
        '<span style="font-weight:700;color:#0f172a">${currentUser?.full_name || 'Responder Unit'}</span><br/>'+
        '<span style="background:#dbeafe;color:#1d4ed8;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700">${currentUser?.role || 'RESPONDER'}</span>'+
        '</div>'
      );
    `
    : '';

  const navigationLinesArr = [];
  sosList.forEach(s => {
    if (['DISPATCHED', 'RESPONDING'].includes(s.status) && s.lat && s.lng) {
      if (s.dispatched_responders && s.dispatched_responders.length > 0) {
        s.dispatched_responders.forEach(dr => {
          let resLat = null, resLng = null, isMe = false;
          if (currentUser && dr.responder_id === currentUser.id && myLoc) { resLat = myLoc.lat; resLng = myLoc.lng; isMe = true; }
          else {
            const rObj = responders.find(r => r.id === dr.responder_id);
            if (rObj && rObj.last_lat && rObj.last_lng) { resLat = rObj.last_lat; resLng = rObj.last_lng; }
          }
          if (resLat && resLng) {
            const isBackup = dr.dispatch_type === 'BACKUP';
            const lineCol = isBackup ? '#f59e0b' : '#dc2626';
            const dashArr = isBackup ? '8, 8' : '12, 12';
            navigationLinesArr.push(`L.polyline([[${resLat}, ${resLng}], [${s.lat}, ${s.lng}]], { color: '${lineCol}', weight: ${isMe ? 5 : 4}, opacity: 0.9, dashArray: '${dashArr}', lineCap: 'round' }).addTo(map);`);
          }
        });
      } else if (myLoc && activeAssignedSOS && activeAssignedSOS.id === s.id) {
        navigationLinesArr.push(`L.polyline([[${myLoc.lat}, ${myLoc.lng}], [${s.lat}, ${s.lng}]], { color: '#dc2626', weight: 5, opacity: 0.95, dashArray: '12, 12', lineCap: 'round' }).addTo(map);`);
      }
    }
  });

  const sosMarkersJS = sosList.filter(s => s.lat && s.lng).map(s => {
    const isTarget = activeAssignedSOS && activeAssignedSOS.id === s.id;
    const markerBg = isTarget ? '#dc2626' : '#ef4444';
    const labelBadge = isTarget ? '🎯 YOUR ASSIGNED RESCUE TARGET' : '🆘 SOS Request';
    const citizenNameClean = (s.citizen_name || 'Resident').replace(/'/g, "\\'");
    return `
      L.marker([${s.lat},${s.lng}],{
        icon:L.divIcon({
          html:'<div style="position:relative;width:44px;height:44px;"><div style="position:absolute;top:0;left:0;width:44px;height:44px;border-radius:50%;background:${isTarget ? 'rgba(220,38,38,0.5)' : 'rgba(239,68,68,0.3)'};animation:pulse 1s ease-out infinite;"></div><div style="position:absolute;top:8px;left:8px;width:28px;height:28px;border-radius:50%;background:${markerBg};border:3px solid #fff;box-shadow:0 0 12px rgba(220,38,38,0.9);display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;">${isTarget ? '🎯' : '🆘'}</div></div>',
          className:'custom-div-icon',iconSize:[44,44],iconAnchor:[22,22]
        }),zIndexOffset:${isTarget ? 1000 : 600}
      }).addTo(map).bindPopup(
        '<div style="min-width:170px;font-size:13px;line-height:1.6">'+
        '<b style="color:#dc2626">${labelBadge}</b><br/>'+
        '<span style="font-weight:700;font-size:14px">${citizenNameClean}</span><br/>'+
        '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800">${s.status}</span>'+
        '</div>'
      );
    `;
  }).join('\n');

  const markersJS = responders.filter(r => r.last_lat && r.last_lng && (currentUser ? r.id !== currentUser.id : true)).map(r => {
    const cfg = RESPONDER_ROLE_CFG[r.role] || { color: '#64748b', emoji: '👤' };
    const fullNameClean = (r.full_name || 'Responder').replace(/'/g, "\\'");
    let dispatchBadge = '';
    for (const sosItem of sosList) {
      if (sosItem.dispatched_responders) {
        const matchDr = sosItem.dispatched_responders.find(dr => dr.responder_id === r.id);
        if (matchDr) {
          const isBackup = matchDr.dispatch_type === 'BACKUP';
          dispatchBadge = `<span style="background:${isBackup ? '#fef3c7' : '#dbeafe'};color:${isBackup ? '#b45309' : '#1d4ed8'};padding:1px 6px;border-radius:999px;font-size:10px;font-weight:800;border:1px solid ${isBackup ? '#fcd34d' : '#93c5fd'}">🚨 ${matchDr.dispatch_type}</span><br/>`;
          break;
        }
      }
    }
    return `
      L.marker([${r.last_lat},${r.last_lng}],{
        icon:L.divIcon({
          html:'<div style="width:36px;height:36px;border-radius:50%;background:${cfg.color};border:3px solid white;box-shadow:0 0 0 3px ${cfg.color}55,0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:16px;">${cfg.emoji}</div>',
          className:'custom-div-icon',iconSize:[36,36],iconAnchor:[18,18]
        }),zIndexOffset:400
      }).addTo(map).bindPopup('<div style="min-width:160px;font-size:13px;line-height:1.6"><b style="color:${cfg.color}">${fullNameClean}</b><br/>${dispatchBadge}<span style="background:${cfg.color}22;color:${cfg.color};padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid ${cfg.color}">${r.role}</span></div>');
    `;
  }).join('\n');

  const boundsPoints = [];
  if (myLoc) boundsPoints.push([myLoc.lat, myLoc.lng]);
  sosList.forEach(s => { if (s.lat && s.lng) boundsPoints.push([s.lat, s.lng]); });
  responders.forEach(r => { if (r.last_lat && r.last_lng) boundsPoints.push([r.last_lat, r.last_lng]); });
  let fitBoundsJS = `map.setView([${myLoc?.lat || LUMBAN_CENTER.lat},${myLoc?.lng || LUMBAN_CENTER.lng}], 14);`;
  if (boundsPoints.length > 1) fitBoundsJS = `var bounds = L.latLngBounds(${JSON.stringify(boundsPoints)}); map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });`;

  const html = `<!DOCTYPE html><html><head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{height:100%;width:100%;background:#f2efe9;touch-action:none}
    .leaflet-marker-icon, .leaflet-marker-shadow{position:absolute !important;}
    @keyframes pulse{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.2);opacity:0}}
  </style>
  </head><body><div id="map"></div><script>
    var map=L.map('map',{zoomControl:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
    ${currentUserMarkerJS}
    ${sosMarkersJS}
    ${markersJS}
    ${navigationLinesArr.join('\n')}
    ${fitBoundsJS}
  </script></html>`;

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color="#2563eb" size="large" />
        </View>
      )}
      <WebView
        source={{ html }}
        style={{ flex: 1 }}
        onLoad={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        nestedScrollEnabled
        originWhitelist={['*']}
      />

      <TouchableOpacity
        style={styles.fullScreenOverlayBtn}
        onPress={() => setIsFullScreen(true)}
        activeOpacity={0.85}>
        <Ionicons name="expand" size={13} color="#ffffff" />
        <Text style={styles.fullScreenOverlayText}>Full-Screen</Text>
      </TouchableOpacity>

      <Modal
        visible={isFullScreen}
        animationType="slide"
        hardwareAccelerated
        onRequestClose={() => setIsFullScreen(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>🚨 Responder Tactical SOS Map</Text>
              <Text style={styles.modalSub}>
                Your Location · Active Responders · Resident SOS Requests
              </Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsFullScreen(false)}>
              <Ionicons name="close-circle" size={18} color="#ffffff" />
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <WebView
              source={{ html }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              nestedScrollEnabled
              originWhitelist={['*']}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function BarangaySosMap({ sosList = [], userLocation = null, height = 320 }) {
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const center = sosList.length > 0 && sosList[0].lat
    ? { lat: sosList[0].lat, lng: sosList[0].lng }
    : userLocation || LUMBAN_CENTER;

  const sosMarkersJS = sosList
    .filter(s => s.lat && s.lng)
    .map(s => `
  L.marker([${ s.lat }, ${ s.lng }], {
    icon: L.divIcon({
      html: '<div style="position:relative;width:48px;height:48px;"><div style="position:absolute;top:0;left:0;width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.3);animation:pulse 1.2s ease-out infinite;"></div><div style="position:absolute;top:8px;left:8px;width:32px;height:32px;border-radius:50%;background:rgba(239,68,68,0.5);animation:pulse 1.2s ease-out infinite 0.2s;"></div><div style="position:absolute;top:14px;left:14px;width:20px;height:20px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 0 8px rgba(239,68,68,0.9);"></div></div>',
      className: '', iconSize: [48, 48], iconAnchor: [24, 24]
    }), zIndexOffset: 600
  }).addTo(map).bindPopup(
    '<div style="min-width:170px;font-size:13px;line-height:1.7">' +
    '<b style="color:#dc2626">🆘 SOS Request</b><br/>' +
    '<b>${s.citizen_name || 'Unknown'}</b><br/>' +
  '${s.citizen_phone ? `<span style="color:#64748b">${s.citizen_phone}</span><br/>` : ''}' +
  '${s.message ? `<i style="color:#64748b">${s.message}</i><br/>` : ''}' +
  '<span style="background:#fee2e2;color:#dc2626;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700">${s.status}</span>' +
  '</div>'
  );
  `).join('\n');

  const userMarkerJS = userLocation
    ? `L.marker([${ userLocation.lat }, ${ userLocation.lng }], {
    icon: L.divIcon({
      html: '<div style="width:18px;height:18px;border-radius:50%;background:#7c3aed;border:3px solid white;box-shadow:0 0 0 5px rgba(124,58,237,0.3);"></div>',
      className: '', iconSize: [18, 18], iconAnchor: [9, 9]
    }), zIndexOffset: 500
  }).addTo(map).bindPopup('<div style="font-size:13px"><b>🏛️ Your Location</b></div>'); `
    : '';

  const html = `< !DOCTYPE html > <html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        html,body,#map{height:100%;width:100%;background:#f2efe9;touch-action:none}
        @keyframes pulse{0 % { transform: scale(1); opacity: 0.8 }100%{transform:scale(2.2);opacity:0}}
      </style>
  </head><body><div id="map"></div><script>
    var map=L.map('map',{zoomControl:true}).setView([${center.lat},${center.lng}],15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
    ${userMarkerJS}
    ${sosMarkersJS}
    ${sosList.length === 0 ? `
      var noSos=L.control({position:'topright'});
      noSos.onAdd=function(){var d=L.DomUtil.create('div');d.style.cssText='background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:12px;color:#64748b;font-family:sans-serif';d.innerHTML='✅ No active SOS in your barangay';return d;};
      noSos.addTo(map);
    ` : ''}
  </script></body></html>`;

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color="#ef4444" size="large" />
        </View>
      )}
      <WebView
        source={{ html }}
        style={{ flex: 1 }}
        onLoad={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        nestedScrollEnabled
        originWhitelist={['*']}
      />

      <TouchableOpacity
        style={styles.fullScreenOverlayBtn}
        onPress={() => setIsFullScreen(true)}
        activeOpacity={0.85}>
        <Ionicons name="expand" size={13} color="#ffffff" />
        <Text style={styles.fullScreenOverlayText}>Full-Screen</Text>
      </TouchableOpacity>

      <Modal
        visible={isFullScreen}
        animationType="slide"
        hardwareAccelerated
        onRequestClose={() => setIsFullScreen(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>🏛️ Barangay Incident Map (Full-Screen)</Text>
              <Text style={styles.modalSub}>Barangay level incident monitoring · Live emergency locations</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsFullScreen(false)}>
              <Ionicons name="close-circle" size={18} color="#ffffff" />
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <WebView
              source={{ html }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              nestedScrollEnabled
              originWhitelist={['*']}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  fullScreenOverlayBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 20,
  },
  fullScreenOverlayText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
  },
  modalSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  modalCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
