import { useState, useRef, useEffect, useMemo } from 'react';
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
  'Balimbingan': [14.3002, 121.4603],
  'Balubad': [14.2766, 121.4779],
  'Caliraya': [14.2968, 121.5562],
  'Concepcion': [14.2986, 121.4540],
  'Lewin': [14.3025, 121.5155],
  'Maracta': [14.2985, 121.4597],
  'Maytalang I': [14.2884, 121.4583],
  'Maytalang II': [14.2968, 121.4345],
  'Primera Parang': [14.2924, 121.4613],
  'Primera Pulo': [14.3013, 121.4601],
  'Salac': [14.2954, 121.4607],
  'Segunda Parang': [14.2942, 121.4607],
  'Segunda Pulo': [14.3031, 121.4607],
  'Santo Niño': [14.2969, 121.4597],
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
    var streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19});
    var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'© Esri',maxZoom:19});
    var topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{attribution:'© OpenTopoMap',maxZoom:17});
    streetLayer.addTo(map);

    var baseMaps = {
      "🗺️ Street": streetLayer,
      "🛰️ Satellite": satelliteLayer,
      "⛰️ Topographic": topoLayer
    };
    L.control.layers(baseMaps, null, { position: 'topright', collapsed: true }).addTo(map);

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
    var streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19});
    var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'© Esri',maxZoom:19});
    var topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{attribution:'© OpenTopoMap',maxZoom:17});
    streetLayer.addTo(map);

    var baseMaps = {
      "🗺️ Street": streetLayer,
      "🛰️ Satellite": satelliteLayer,
      "⛰️ Topographic": topoLayer
    };
    L.control.layers(baseMaps, null, { position: 'topright', collapsed: true }).addTo(map);

    var border = ${borderJS};
    L.geoJSON(border,{style:{color:'#ef4444',weight:3,fillOpacity:0,dashArray:'6 3'},interactive:false}).addTo(map);

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
  PNP: { color: '#1d4ed8', emoji: '👮' },
  BFP: { color: '#ea580c', emoji: '🚒' },
  COAST_GUARD: { color: '#0284c7', emoji: '⚓' },
  RHU: { color: '#16a34a', emoji: '🏥' },
  MDRRMO: { color: '#dc2626', emoji: '🚨' },
  MDRRMO_RESPONDER: { color: '#dc2626', emoji: '🚨' },
  BARANGAY_OFFICIAL: { color: '#7e22ce', emoji: '🏢' },
  RESCUE: { color: '#0ea5e9', emoji: '⛑️' },
};

export function SOSTrackingMap({ sosLocation = null, responders = [], assignedResponders = [], assignedRescueId = null, height = 320 }) {
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const webViewRef = useRef(null);
  const modalWebViewRef = useRef(null);

  const center = sosLocation
    ? { lat: sosLocation.lat, lng: sosLocation.lng }
    : LUMBAN_CENTER;

  let safeAssignedResponders = assignedResponders;
  if (typeof safeAssignedResponders === 'string') {
    try {
      safeAssignedResponders = JSON.parse(safeAssignedResponders);
    } catch (e) {
      safeAssignedResponders = [];
    }
  }
  if (!Array.isArray(safeAssignedResponders)) safeAssignedResponders = [];

  const assignedIds = new Set();
  const acceptedIds = new Set();
  safeAssignedResponders.forEach(dr => {
    if (dr.status === 'DECLINED' || dr.status === 'COMPLETED') return;
    const rid = dr.responder_id || dr.id;
    if (rid) {
      assignedIds.add(String(rid).toLowerCase());
      if (['ACCEPTED', 'EN_ROUTE', 'RESCUE_IN_PROGRESS'].includes(dr.status) || ['EN_ROUTE', 'RESCUE_IN_PROGRESS'].includes(dr.responder_duty_status)) {
        acceptedIds.add(String(rid).toLowerCase());
      }
    }
  });
  if (assignedRescueId) {
    const arId = String(assignedRescueId).toLowerCase();
    assignedIds.add(arId);
    if (sosLocation?.status === 'RESPONDING') {
      acceptedIds.add(arId);
    }
  }

  // Merge any assigned responders that already have coordinates into the candidate pool
  const respondersMap = new Map();
  (responders || []).forEach(r => {
    if (r && r.id) {
      respondersMap.set(String(r.id).toLowerCase(), {
        ...r,
        last_lat: r.last_lat != null ? r.last_lat : r.latitude,
        last_lng: r.last_lng != null ? r.last_lng : r.longitude,
      });
    }
  });

  safeAssignedResponders.forEach(ar => {
    const arId = String(ar.responder_id || ar.id || '').toLowerCase();
    if (!arId) return;
    const arLat = ar.last_lat != null ? ar.last_lat : ar.latitude;
    const arLng = ar.last_lng != null ? ar.last_lng : ar.longitude;
    const existing = respondersMap.get(arId);
    if (existing) {
      if ((existing.last_lat == null || existing.last_lng == null) && arLat != null && arLng != null) {
        existing.last_lat = arLat;
        existing.last_lng = arLng;
      }
      if (!existing.role && ar.role) existing.role = ar.role;
      if (!existing.full_name && ar.full_name) existing.full_name = ar.full_name;
      if (!existing.dispatch_type && ar.dispatch_type) existing.dispatch_type = ar.dispatch_type;
    } else if (arLat != null && arLng != null) {
      respondersMap.set(arId, {
        id: ar.responder_id || ar.id,
        full_name: ar.full_name,
        role: ar.role,
        phone_number: ar.phone_number,
        last_lat: arLat,
        last_lng: arLng,
        last_location_at: ar.last_location_at,
        responder_status: ar.responder_status || ar.responder_duty_status || 'AVAILABLE',
        dispatch_type: ar.dispatch_type || 'PRIMARY'
      });
    }
  });

  const allResponders = Array.from(respondersMap.values());

  // Filter responders to only active, valid locations:
  const validResponders = allResponders.filter(r => {
    const lat = parseFloat(r.last_lat != null ? r.last_lat : r.latitude);
    const lng = parseFloat(r.last_lng != null ? r.last_lng : r.longitude);
    if (isNaN(lat) || isNaN(lng)) return false;

    const rId = String(r.id).toLowerCase();
    // If specific units have been assigned to this rescue, ALWAYS display assigned units:
    if (assignedIds.size > 0) {
      return assignedIds.has(rId);
    }
    // If no units assigned yet, only show online/active units:
    if (r.responder_status === 'OFF_DUTY' || r.responder_status === 'UNAVAILABLE') return false;
    return true;
  });

  const assignedIdsArr = useMemo(() => Array.from(assignedIds), [safeAssignedResponders, assignedRescueId]);
  const acceptedIdsArr = useMemo(() => Array.from(acceptedIds), [safeAssignedResponders, assignedRescueId, sosLocation?.status]);

  const updateDataPayload = useMemo(() => {
    return JSON.stringify({
      responders: validResponders,
      sosLocation,
      assignedIds: assignedIdsArr,
      acceptedIds: acceptedIdsArr
    });
  }, [validResponders, sosLocation, assignedIdsArr, acceptedIdsArr]);

  // Dynamically update Leaflet markers and lines without reloading WebView
  useEffect(() => {
    if (!mapReady) return;
    const jsCode = `if (typeof window.updateRescueData === 'function') { window.updateRescueData(${updateDataPayload}); } true;`;
    webViewRef.current?.injectJavaScript(jsCode);
    if (isFullScreen && modalWebViewRef.current) {
      modalWebViewRef.current?.injectJavaScript(jsCode);
    }
  }, [updateDataPayload, mapReady, isFullScreen]);

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
    var streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19});
    var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'© Esri',maxZoom:19});
    var topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{attribution:'© OpenTopoMap',maxZoom:17});
    streetLayer.addTo(map);

    var baseMaps = {
      "🗺️ Street": streetLayer,
      "🛰️ Satellite": satelliteLayer,
      "⛰️ Topographic": topoLayer
    };
    L.control.layers(baseMaps, null, { position: 'topright', collapsed: true }).addTo(map);

    window.sosMarker = null;
    window.responderMarkers = {};
    window.navigationLines = [];
    window.hasAutoFitted = false;

    var ROLE_CFG = {
      PNP: { color: '#1d4ed8', emoji: '👮' },
      BFP: { color: '#ea580c', emoji: '🚒' },
      COAST_GUARD: { color: '#0284c7', emoji: '⚓' },
      RHU: { color: '#16a34a', emoji: '🏥' },
      MDRRMO: { color: '#dc2626', emoji: '🚨' },
      MDRRMO_RESPONDER: { color: '#dc2626', emoji: '🚨' },
      BARANGAY_OFFICIAL: { color: '#7e22ce', emoji: '🏢' },
      RESCUE: { color: '#0ea5e9', emoji: '⛑️' }
    };

    window.updateRescueData = function(data) {
      try {
        if (!data) return;
        var sosLoc = data.sosLocation;
        var rList = data.responders || [];
        var assignedIds = data.assignedIds || [];
        var acceptedIds = data.acceptedIds || [];

        // 1. SOS Marker
        if (sosLoc && sosLoc.lat && sosLoc.lng) {
          if (!window.sosMarker) {
            var sosIcon = L.divIcon({
              html: '<div style="position:relative;width:48px;height:48px;"><div style="position:absolute;top:0;left:0;width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.3);animation:pulse 1.2s ease-out infinite;"></div><div style="position:absolute;top:8px;left:8px;width:32px;height:32px;border-radius:50%;background:rgba(239,68,68,0.5);animation:pulse 1.2s ease-out infinite 0.2s;"></div><div style="position:absolute;top:14px;left:14px;width:20px;height:20px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 0 8px rgba(239,68,68,0.9);display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;">🆘</div></div>',
              className: 'custom-div-icon',
              iconSize: [48, 48],
              iconAnchor: [24, 24]
            });
            window.sosMarker = L.marker([sosLoc.lat, sosLoc.lng], { icon: sosIcon, zIndexOffset: 800 })
              .addTo(map)
              .bindPopup('<div style="font-size:13px;font-weight:700;color:#dc2626">🆘 Your SOS Location</div>');
          } else {
            window.sosMarker.setLatLng([sosLoc.lat, sosLoc.lng]);
          }
        }

        // 2. Remove old polylines
        if (window.navigationLines && window.navigationLines.length > 0) {
          window.navigationLines.forEach(function(l) { map.removeLayer(l); });
        }
        window.navigationLines = [];

        var activeKeys = {};
        var boundsPoints = [];
        if (sosLoc && sosLoc.lat && sosLoc.lng) {
          boundsPoints.push([sosLoc.lat, sosLoc.lng]);
        }

        rList.forEach(function(r) {
          var rid = String(r.id).toLowerCase();
          activeKeys[rid] = true;
          var rLat = parseFloat(r.last_lat != null ? r.last_lat : r.latitude);
          var rLng = parseFloat(r.last_lng != null ? r.last_lng : r.longitude);
          if (isNaN(rLat) || isNaN(rLng)) return;

          boundsPoints.push([rLat, rLng]);

          var isAssigned = assignedIds.indexOf(rid) !== -1;
          var isAccepted = acceptedIds.indexOf(rid) !== -1;
          var isBackup = String(r.dispatch_type || '').toUpperCase() === 'BACKUP';
          var cfg = ROLE_CFG[r.role] || { color: '#64748b', emoji: '👤' };
          var badgeHtml = isAssigned
            ? '<span style="background:' + (isBackup ? '#fef3c7' : '#fee2e2') + ';color:' + (isBackup ? '#b45309' : '#dc2626') + ';padding:1px 6px;border-radius:999px;font-size:10px;font-weight:800;border:1px solid ' + (isBackup ? '#fcd34d' : '#fca5a5') + '">🚨 ' + (isBackup ? 'BACKUP RESCUE' : 'PRIMARY RESCUE') + '</span><br/>'
            : '';
          var fullNameClean = (r.full_name || 'Responder').replace(/'/g, "\\'");
          var popupContent = '<div style="min-width:160px;font-size:13px;line-height:1.6">' +
            '<b style="color:' + cfg.color + ';font-size:14px">' + fullNameClean + '</b><br/>' +
            badgeHtml +
            '<span style="background:' + cfg.color + '22;color:' + cfg.color + ';padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid ' + cfg.color + '">' + (r.role || 'Rescue') + '</span><br/>' +
            '<span style="color:#16a34a;font-size:11px;font-weight:700">📍 Live Rescue Tracking</span>' +
            '</div>';

          if (window.responderMarkers[rid]) {
            window.responderMarkers[rid].setLatLng([rLat, rLng]);
            window.responderMarkers[rid].setPopupContent(popupContent);
          } else {
            var marker = L.marker([rLat, rLng], {
              icon: L.divIcon({
                html: '<div style="width:38px;height:38px;border-radius:50%;background:' + cfg.color + ';border:3px solid white;box-shadow:0 0 0 3px ' + cfg.color + '55,0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:18px;">' + cfg.emoji + '</div>',
                className: 'custom-div-icon',
                iconSize: [38, 38],
                iconAnchor: [19, 19]
              }),
              zIndexOffset: isAssigned ? 700 : 400
            }).addTo(map).bindPopup(popupContent);
            window.responderMarkers[rid] = marker;
          }

          // Draw vector line from responder to SOS ONLY once accepted
          if (sosLoc && sosLoc.lat && sosLoc.lng && isAccepted) {
            var lineCol = isBackup ? '#f59e0b' : '#dc2626';
            var dashArr = isBackup ? '8, 8' : '12, 12';
            var weight = isBackup ? 4 : 5;
            var poly = L.polyline([[rLat, rLng], [sosLoc.lat, sosLoc.lng]], {
              color: lineCol,
              weight: weight,
              opacity: 0.95,
              dashArray: dashArr,
              lineCap: 'round'
            }).addTo(map);
            window.navigationLines.push(poly);
          }
        });

        // Prune stale markers
        Object.keys(window.responderMarkers).forEach(function(existingId) {
          if (!activeKeys[existingId]) {
            map.removeLayer(window.responderMarkers[existingId]);
            delete window.responderMarkers[existingId];
          }
        });

        window.latestBounds = boundsPoints;

        // Auto-frame on initial load and when responders first appear:
        if (!window.hasFramedResponders && boundsPoints.length > 1) {
          map.fitBounds(L.latLngBounds(boundsPoints), { padding: [45, 45], maxZoom: 16 });
          window.hasFramedResponders = true;
        } else if (!window.hasAutoFitted && boundsPoints.length === 1) {
          map.setView(boundsPoints[0], 15);
          window.hasAutoFitted = true;
        }
      } catch (err) {
        console.error("updateRescueData error:", err);
      }
    };

    // Recenter button control
    var RecenterControl = L.Control.extend({
      options: { position: 'bottomleft' },
      onAdd: function() {
        var btn = L.DomUtil.create('button', 'recenter-btn');
        btn.innerHTML = '🎯';
        btn.title = 'Re-center';
        btn.style.width = '34px';
        btn.style.height = '34px';
        btn.style.background = '#ffffff';
        btn.style.border = '2px solid rgba(0,0,0,0.2)';
        btn.style.borderRadius = '6px';
        btn.style.fontSize = '16px';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 1px 5px rgba(0,0,0,0.3)';
        btn.onclick = function(e) {
          L.DomEvent.stopPropagation(e);
          if (window.latestBounds && window.latestBounds.length > 1) {
            map.fitBounds(L.latLngBounds(window.latestBounds), { padding: [45, 45], maxZoom: 16 });
          } else if (window.latestBounds && window.latestBounds.length === 1) {
            map.setView(window.latestBounds[0], 16);
          }
        };
        return btn;
      }
    });
    new RecenterControl().addTo(map);

    // Initial render with embedded initial data
    window.updateRescueData(${JSON.stringify({
      responders: validResponders,
      sosLocation,
      assignedIds: assignedIdsArr
    })});

    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
    }
  </script></html>`;

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color="#ef4444" size="large" />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={{ flex: 1 }}
        onLoad={() => {
          setLoading(false);
          setMapReady(true);
        }}
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === 'MAP_READY') {
              setMapReady(true);
              setLoading(false);
            }
          } catch(e) {}
        }}
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
          <WebView
            ref={modalWebViewRef}
            source={{ html }}
            style={{ flex: 1 }}
            onLoad={() => {
              if (modalWebViewRef.current) {
                modalWebViewRef.current.injectJavaScript(
                  `if (typeof window.updateRescueData === 'function') { window.updateRescueData(${updateDataPayload}); } true;`
                );
              }
            }}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
          />
        </View>
      </Modal>
    </View>
  );
}

export function ResponderMap({ responders = [], sosList = [], height = 320, currentUser = null, userLocation = null }) {
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const myLoc = userLocation || (currentUser?.last_lat && currentUser?.last_lng ? { lat: currentUser.last_lat, lng: currentUser.last_lng } : null);

  const currentUserId = String(currentUser?.id || '').toLowerCase();
  const isMDRRMO = ['ADMIN', 'SUPER_ADMIN', 'MDRRMO'].includes(String(currentUser?.role || '').toUpperCase());

  // Merge responder locations from responders prop and dispatched_responders in sosList
  const respondersMap = new Map();
  responders.forEach(r => {
    if (r && r.id) {
      respondersMap.set(String(r.id).toLowerCase(), { ...r });
    }
  });

  sosList.forEach(s => {
    let dResponders = s.dispatched_responders;
    if (typeof dResponders === 'string') {
      try { dResponders = JSON.parse(dResponders); } catch (e) { dResponders = []; }
    }
    if (Array.isArray(dResponders)) {
      dResponders.forEach(dr => {
        const id = String(dr.responder_id || dr.id || '').toLowerCase();
        if (!id) return;
        const existing = respondersMap.get(id);
        if (existing) {
          if ((!existing.last_lat || !existing.last_lng) && dr.last_lat && dr.last_lng) {
            existing.last_lat = dr.last_lat;
            existing.last_lng = dr.last_lng;
          }
          if (!existing.role && dr.role) existing.role = dr.role;
          if (!existing.full_name && dr.full_name) existing.full_name = dr.full_name;
          if (!existing.dispatch_type && dr.dispatch_type) existing.dispatch_type = dr.dispatch_type;
        } else if (dr.last_lat && dr.last_lng) {
          respondersMap.set(id, {
            id: dr.responder_id || dr.id,
            full_name: dr.full_name,
            role: dr.role,
            phone_number: dr.phone_number,
            last_lat: dr.last_lat,
            last_lng: dr.last_lng,
            responder_status: dr.responder_duty_status || dr.status || 'AVAILABLE',
            last_location_at: dr.last_location_at || dr.dispatched_at,
            dispatch_type: dr.dispatch_type
          });
        }
      });
    }
  });

  const allResponders = Array.from(respondersMap.values());

  const activeAssignedSOS = sosList.find(s => {
    if (!currentUserId) return false;
    let dResponders = s.dispatched_responders;
    if (typeof dResponders === 'string') {
      try { dResponders = JSON.parse(dResponders); } catch (e) { dResponders = []; }
    }
    const isExplicitlyAssigned = (Array.isArray(dResponders) && dResponders.some(dr => String(dr.responder_id || dr.id).toLowerCase() === currentUserId && dr.status !== 'DECLINED'))
      || (!isMDRRMO && String(s.assigned_rescue_id).toLowerCase() === currentUserId);
    return isExplicitlyAssigned && !['RESOLVED', 'CANCELLED'].includes(s.status);
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
        '<span style="font-weight:700;color:#0f172a">${(currentUser?.full_name || 'Responder Unit').replace(/'/g, "\\'")}</span><br/>'+
        '<span style="background:#dbeafe;color:#1d4ed8;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700">${currentUser?.role || 'RESPONDER'}</span>'+
        '</div>'
      );
    `
    : '';

  const navigationLinesArr = [];
  sosList.forEach(s => {
    if (s.status === 'RESOLVED' || s.status === 'CANCELLED') return;
    const sLat = Number(s.lat);
    const sLng = Number(s.lng);
    if (isNaN(sLat) || isNaN(sLng) || sLat === 0 || sLng === 0) return;

    let dResponders = s.dispatched_responders;
    if (typeof dResponders === 'string') {
      try { dResponders = JSON.parse(dResponders); } catch (e) { dResponders = []; }
    }

    if (Array.isArray(dResponders) && dResponders.length > 0) {
      dResponders.forEach(dr => {
        if (dr.status === 'DECLINED' || dr.status === 'COMPLETED') return;
        // User Requirement: Line appears and updates ONLY when the responder accepts
        const hasAccepted = ['ACCEPTED', 'EN_ROUTE', 'RESCUE_IN_PROGRESS'].includes(dr.status) ||
          ['EN_ROUTE', 'RESCUE_IN_PROGRESS'].includes(dr.responder_duty_status);
        if (!hasAccepted) return;

        const drId = String(dr.responder_id || dr.id || '').toLowerCase();
        const isMe = currentUserId && drId === currentUserId;

        let resLat = null, resLng = null;
        if (isMe && myLoc && myLoc.lat && myLoc.lng) {
          resLat = Number(myLoc.lat);
          resLng = Number(myLoc.lng);
        } else {
          const rObj = respondersMap.get(drId);
          if (rObj && rObj.last_lat && rObj.last_lng) {
            resLat = Number(rObj.last_lat);
            resLng = Number(rObj.last_lng);
          } else if (dr.last_lat && dr.last_lng) {
            resLat = Number(dr.last_lat);
            resLng = Number(dr.last_lng);
          }
        }

        if (resLat && resLng && !isNaN(resLat) && !isNaN(resLng) && resLat !== 0 && resLng !== 0) {
          const isBackup = String(dr.dispatch_type).toUpperCase() === 'BACKUP';
          const lineCol = isBackup ? '#f59e0b' : '#dc2626';
          const dashArr = isBackup ? '8, 8' : '12, 12';
          const weight = isBackup ? 4 : 5;
          navigationLinesArr.push(`L.polyline([[${resLat}, ${resLng}], [${sLat}, ${sLng}]], { color: '${lineCol}', weight: ${weight}, opacity: 0.95, dashArray: '${dashArr}', lineCap: 'round' }).addTo(map);`);
        }
      });
    } else if (s.assigned_rescue_id && !isMDRRMO && s.status === 'RESPONDING') {
      const assignId = String(s.assigned_rescue_id).toLowerCase();
      const isMe = currentUserId && assignId === currentUserId;
      let resLat = null, resLng = null;
      if (isMe && myLoc && myLoc.lat && myLoc.lng) {
        resLat = Number(myLoc.lat);
        resLng = Number(myLoc.lng);
      } else {
        const rObj = respondersMap.get(assignId);
        if (rObj && rObj.last_lat && rObj.last_lng) {
          resLat = Number(rObj.last_lat);
          resLng = Number(rObj.last_lng);
        }
      }
      if (resLat && resLng && !isNaN(resLat) && !isNaN(resLng) && resLat !== 0 && resLng !== 0) {
        navigationLinesArr.push(`L.polyline([[${resLat}, ${resLng}], [${sLat}, ${sLng}]], { color: '#dc2626', weight: 5, opacity: 0.95, dashArray: '12, 12', lineCap: 'round' }).addTo(map);`);
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

  const markersJS = allResponders.filter(r => {
    if (!r.last_lat || !r.last_lng || r.responder_status === 'OFF_DUTY') return false;
    if (currentUser && String(r.id).toLowerCase() === currentUserId && myLoc) return false;
    return true;
  }).map(r => {
    const cfg = RESPONDER_ROLE_CFG[r.role] || { color: '#64748b', emoji: '👤' };
    const fullNameClean = (r.full_name || 'Responder').replace(/'/g, "\\'");
    let dispatchBadge = '';
    for (const sosItem of sosList) {
      let dList = sosItem.dispatched_responders;
      if (typeof dList === 'string') {
        try { dList = JSON.parse(dList); } catch (e) { dList = []; }
      }
      if (Array.isArray(dList)) {
        const matchDr = dList.find(dr => String(dr.responder_id || dr.id).toLowerCase() === String(r.id).toLowerCase());
        if (matchDr) {
          const isBackup = String(matchDr.dispatch_type).toUpperCase() === 'BACKUP';
          dispatchBadge = `<span style="background:${isBackup ? '#fef3c7' : '#dbeafe'};color:${isBackup ? '#b45309' : '#1d4ed8'};padding:1px 6px;border-radius:999px;font-size:10px;font-weight:800;border:1px solid ${isBackup ? '#fcd34d' : '#93c5fd'}">🚨 ${matchDr.dispatch_type || (isBackup ? 'BACKUP' : 'PRIMARY')}</span><br/>`;
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
  allResponders.forEach(r => { if (r.last_lat && r.last_lng) boundsPoints.push([r.last_lat, r.last_lng]); });
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
    var streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19});
    var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'© Esri',maxZoom:19});
    var topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{attribution:'© OpenTopoMap',maxZoom:17});
    streetLayer.addTo(map);

    var baseMaps = {
      "🗺️ Street": streetLayer,
      "🛰️ Satellite": satelliteLayer,
      "⛰️ Topographic": topoLayer
    };
    L.control.layers(baseMaps, null, { position: 'topright', collapsed: true }).addTo(map);
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
    ? `L.marker([${userLocation.lat}, ${userLocation.lng}], {
    icon: L.divIcon({
      html: '<div style="width:18px;height:18px;border-radius:50%;background:#7c3aed;border:3px solid white;box-shadow:0 0 0 5px rgba(124,58,237,0.3);"></div>',
      className: '', iconSize: [18, 18], iconAnchor: [9, 9]
    }), zIndexOffset: 500
  }).addTo(map).bindPopup('<div style="font-size:13px"><b>🏛️ Your Location</b></div>');`
    : '';

  const boundsPoints = [];
  if (userLocation) boundsPoints.push([userLocation.lat, userLocation.lng]);
  sosList.forEach(s => { if (s.lat && s.lng) boundsPoints.push([s.lat, s.lng]); });

  let fitBoundsJS = `map.setView([${center.lat},${center.lng}], 15);`;
  if (boundsPoints.length > 1) {
    fitBoundsJS = `var bounds = L.latLngBounds(${JSON.stringify(boundsPoints)}); map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });`;
  }

  const linesJS = (userLocation && sosList.length > 0)
    ? sosList
        .filter(s => s.lat && s.lng && ['ACCEPTED', 'RESPONDING'].includes(s.status))
        .map(s => `L.polyline([[${userLocation.lat}, ${userLocation.lng}], [${s.lat}, ${s.lng}]], { color: '#dc2626', weight: 5, opacity: 0.95, dashArray: '12, 12', lineCap: 'round' }).addTo(map);`)
        .join('\n')
    : '';

  const html = `<!DOCTYPE html><html><head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{height:100%;width:100%;background:#f2efe9;touch-action:none}
    @keyframes pulse{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.2);opacity:0}}
  </style>
  </head><body><div id="map"></div><script>
    var map=L.map('map',{zoomControl:true});
    var streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19});
    var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'© Esri',maxZoom:19});
    var topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{attribution:'© OpenTopoMap',maxZoom:17});
    streetLayer.addTo(map);

    var baseMaps = {
      "🗺️ Street": streetLayer,
      "🛰️ Satellite": satelliteLayer,
      "⛰️ Topographic": topoLayer
    };
    L.control.layers(baseMaps, null, { position: 'topleft', collapsed: true }).addTo(map);
    ${userMarkerJS}
    ${sosMarkersJS}
    ${linesJS}
    ${fitBoundsJS}
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
