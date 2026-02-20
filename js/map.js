// js/map.js
let map, geoLayer, regionToFeature = new Map();
let currentSelection = null;

// Paleta para choropleth (ventas -> relleno)
function colorFor(value, max){
  const t = max ? (value / max) : 0; // 0..1
  // verde suave -> verde intenso
  const alpha = 0.20 + 0.50 * t;      // 0.2..0.7
  return `rgba(34,197,94,${alpha})`;  // #22c55e con alpha
}

export function initMap(geojson, { onRegionSelected }){
  // Creamos el mapa sin capa base (solo el contorno)
  map = L.map('map', {
    zoomControl: true,
    attributionControl: false, // sin créditos (no hay tiles)
    scrollWheelZoom: true
  });

  // Función para obtener el nombre de la región desde las properties del GeoJSON.
  // Ajusta para coincidir con tu archivo: NAME_1, NOMBRE, name, etc.
  function getName(props){
    return props.NAME_1 || props.NOMBRE || props.name || props.Name || props.admin || props.DEPARTAMEN || 'SinNombre';
  }

  function baseStyle(){
    return { color:'#16a34a', weight:1, fillColor:'#86efac', fillOpacity:0.30 };
  }

  function onEachFeature(feature, layer){
    const rName = getName(feature.properties);
    regionToFeature.set(rName, layer);

    layer.on({
      mouseover: (e)=> e.target.setStyle({ weight:2, fillOpacity:0.40 }),
      mouseout:  (e)=> {
        if(currentSelection !== rName) e.target.setStyle({ weight:1, fillOpacity:0.30 });
      },
      click: ()=>{
        // Alternar selección
        currentSelection = (currentSelection === rName) ? null : rName;
        onRegionSelected && onRegionSelected(currentSelection);
      }
    });

    layer.bindTooltip(rName, { sticky:true });
  }

  geoLayer = L.geoJSON(geojson, {
    style: baseStyle,
    onEachFeature
  }).addTo(map);

  // Ajustar vista al contorno de Honduras
  const bounds = geoLayer.getBounds();
  map.fitBounds(bounds);

  // Restringir navegación para no salirte del país (con un pequeño padding)
  map.setMaxBounds(bounds.pad(0.25));
  // Opcional: limitar el zoom mínimo para que no se vea demasiado “lejos”
  map.setMinZoom(map.getZoom());
}

export function updateMap(porRegion, selectedRegion){
  currentSelection = selectedRegion || null;

  // Índice de ventas por región
  const sales = new Map(porRegion.map(x => [x.region, x.ventas]));
  const max = Math.max(1, ...porRegion.map(x => x.ventas));

  // Reaplicar estilo por región (choropleth + selección)
  regionToFeature.forEach((layer, rName) => {
    const v = sales.get(rName) || 0;
    const isSel = (currentSelection === rName);

    layer.setStyle({
      fillColor: colorFor(v, max),
      fillOpacity: isSel ? 0.65 : 0.30,
      color: isSel ? '#0ea5e9' : '#16a34a',
      weight: isSel ? 3 : 1
    });

    layer.bindPopup(`<strong>${rName}</strong><br>Ventas filtradas: ${v.toLocaleString()}`);
  });
}