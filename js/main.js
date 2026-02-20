import { initCharts, updateCharts, onChartEvents } from './chart.js';
import { initMap, updateMap } from './map.js';
import { startTour } from './tour.js';

let RAW = null;
// Guardamos también el nombre original de la región para mostrarlo en UI
const state = { region: null, regionOriginal: null, categoria: null, producto: null, mes: null };

/* ===============================
   LOAD JSON
================================ */
async function loadJSON(path){
  const res = await fetch(path, { cache: 'no-store' });
  if(!res.ok){
    throw new Error(`No se pudo cargar ${path} (HTTP ${res.status})`);
  }

  const txt = await res.text();
  if (!txt || txt.trim().length === 0){
    throw new Error(`${path} está vacío (0 bytes).`);
  }
  return JSON.parse(txt);
}

/* ===============================
   HELPERS (dataset)
================================ */

// Lee detalle desde ventas.json soportando ambas claves
function getDetalle(data){
  if (!data) return [];
  if (Array.isArray(data.detalle_actualizado)) return data.detalle_actualizado;
  if (Array.isArray(data.detalle))            return data.detalle;
  console.warn('[getDetalle] No se encontró detalle ni detalle_actualizado');
  return [];
}

// Asegura ingresos_hnl para todas las filas
function withIngresos(rows){
  if (!Array.isArray(rows)) return [];
  return rows.map(r => {
    const ingresos = (r.ingresos_hnl != null)
      ? Number(r.ingresos_hnl)
      : Number(r.precio_unitario_hnl ?? 0) * Number(r.ventas ?? 0);
    return { ...r, ingresos_hnl: ingresos };
  });
}

// Suma por grupo para una columna concreta
function groupSumBy(rows, groupKey, valueKey){
  if (!Array.isArray(rows)) {
    console.warn('[groupSumBy] rows no es arreglo. Valor recibido =', rows);
    rows = [];
  }
  const m = new Map();
  rows.forEach(r => {
    const k = r?.[groupKey];
    const v = Number(r?.[valueKey] ?? 0);
    m.set(k, (m.get(k) || 0) + v);
  });
  return Array.from(m, ([key, total]) => ({ key, total }));
}

// Devuelve todos los meses (YYYY-MM) presentes en el dataset completo, ordenados
function getAllMonthsFromRAW(){
  const all = getDetalle(RAW);
  const meses = Array.from(new Set(all.map(r => r.mes).filter(Boolean)))
    .sort((a,b) => String(a).localeCompare(String(b)));
  return meses;
}

/* ===============================
   HELPERS (filtros y normalización)
================================ */

// Normaliza texto: quita tildes, espacios extra y homogeneiza mayúsculas
function normalizeKey(str){
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // tildes fuera
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// Elimina sufijos/prefijos típicos de GeoJSON (si aplican)
function regionKey(name){
  const key = normalizeKey(name);
  return key.replace(/\s+DEPARTMENT$|^\s*DEPTO\.\s*/g, '');
}

// Para mostrar en UI (si quieres mapear a versiones “bonitas”, hazlo aquí)
function regionDisplay(nameOrKey){
  return nameOrKey;
}

function applyFilters(rows){
  if (!Array.isArray(rows)) return [];
  return rows.filter(r =>
    (state.region    ? regionKey(r.region)    === state.region    : true) &&
    (state.categoria ? r.categoria            === state.categoria : true) &&
    (state.producto  ? r.producto             === state.producto  : true) &&
    (state.mes       ? r.mes                  === state.mes       : true)
  );
}

function describeFilters(){
  const parts = [];
  if(state.region)    parts.push(`Región: ${regionDisplay(state.regionOriginal ?? state.region)}`);
  if(state.categoria) parts.push(`Categoría: ${state.categoria}`);
  if(state.producto)  parts.push(`Producto: ${state.producto}`);
  if(state.mes)       parts.push(`Mes: ${state.mes}`);
  return parts.length ? parts.join(' · ') : 'Sin filtros';
}

/* ===============================
   AGREGADOS PARA CHARTS / MAPA
================================ */
function aggregateForCharts(rows){
  // Defensa
  if (!Array.isArray(rows)) rows = [];

  // 1) Garantiza ingresos en cada fila
  const data = withIngresos(rows);

  // 2) Meses del dataset completo (eje X estable)
  const baseMonths = getAllMonthsFromRAW();

  // === Línea (DINERO): suma ingresos por mes y rellena los meses sin datos con 0 ===
  const sumMes = new Map(
    groupSumBy(data, 'mes', 'ingresos_hnl').map(x => [String(x.key), x.total])
  );
  const porMes = baseMonths.map(mes => ({
    mes,
    ventas: sumMes.get(mes) ?? 0          // “ventas” aquí = dinero (compatibilidad con chart.js)
  }));

  // === Pie/Bar/Mapa (UNIDADES) — si quisieras dinero, cambia 'ventas' -> 'ingresos_hnl' ===
  const porCat = groupSumBy(data, 'categoria', 'ventas')
    .filter(x => x.key != null && x.key !== '')
    .map(x => ({ categoria: String(x.key), ventas: x.total }));

  const porProd = groupSumBy(data, 'producto', 'ventas')
    .filter(x => x.key != null && x.key !== '')
    .sort((a,b) => b.total - a.total)
    .slice(0, 5)
    .map(x => ({ producto: String(x.key), ventas: x.total }));

  const porReg = groupSumBy(data, 'region', 'ventas')
    .filter(x => x.key != null && x.key !== '')
    .map(x => ({ region: String(x.key), ventas: x.total }));

  return { porMes, porCat, porProd, porReg };
}

/* ===============================
   REFRESH DASHBOARD
================================ */
function refresh(){
  const detalle = getDetalle(RAW);
  const filtered = applyFilters(detalle);
  const aggs = aggregateForCharts(filtered);

  document.getElementById('filtrosActivos').textContent = describeFilters();

  updateCharts({
    moneda: RAW?.resumen?.moneda || 'HNL',
    por_mes: aggs.porMes,
    por_categoria: aggs.porCat,
    top_productos: aggs.porProd
  });

  // Para resaltar en mapa, pasamos la CLAVE normalizada
  updateMap(aggs.porReg, state.region);
}

/* ===============================
   UI ACTIONS  (NO TOCAR EXPORTS)
================================ */
function clearFilters(){
  state.region = state.regionOriginal = state.categoria = state.producto = state.mes = null;
  refresh();
}

function exportCSV(){
  const detalle = getDetalle(RAW);
  const filtered = applyFilters(detalle);

  if(!filtered.length){
    alert("No hay datos para exportar.");
    return;
  }

  const headers = Object.keys(filtered[0]).join(",");
  const rows = filtered.map(obj =>
    Object.values(obj).map(v => `"${v}"`).join(",")
  );

  const csvContent = [headers, ...rows].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "ventas_filtradas.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

async function exportPDF(){
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  const cards = [
    document.getElementById("map"),
    document.getElementById("lineChart"),
    document.getElementById("pieChart"),
    document.getElementById("barChart")
  ];

  const originalStyles = [];
  cards.forEach(card => {
    originalStyles.push({
      background: card.style.background,
      color: card.style.color
    });

    // Fondo oscuro temporal + texto claro
    card.style.background = "#000000";
    card.style.color = "#ffffff";
    card.querySelectorAll("*").forEach(el => { el.style.color = "#ffffff"; });
  });

  let yPosition = 15;

  for (let i = 0; i < cards.length; i++) {
    const canvas = await html2canvas(cards[i], {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true
    });

    const imgData = canvas.toDataURL("image/png");
    const imgWidth = 180;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (yPosition + imgHeight > 280) {
      pdf.addPage();
      yPosition = 15;
    }

    pdf.addImage(imgData, "PNG", 15, yPosition, imgWidth, imgHeight);
    yPosition += imgHeight + 10;
  }

  // Restaurar estilos
  cards.forEach((card, index) => {
    card.style.background = originalStyles[index].background;
    card.style.color = originalStyles[index].color;
    card.querySelectorAll("*").forEach(el => { el.style.color = ""; });
  });

  pdf.save("Dashboard_Ventas.pdf");
}

/* ===============================
   BOOTSTRAP
================================ */
(async () => {
  const ventas = await loadJSON('./data/ventas.json');
  const geo = await loadJSON('./data/regiones.geojson');

  RAW = ventas;

  document.getElementById('periodo').textContent = ventas.resumen?.periodo ?? 'N/A';
  document.getElementById('moneda').textContent  = ventas.resumen?.moneda  ?? 'HNL';
  document.getElementById('btnTour')?.addEventListener('click', startTour);

  const detalle = getDetalle(ventas);
  const aggs = aggregateForCharts(detalle);

  initCharts({
    moneda: ventas.resumen?.moneda || 'HNL',
    por_mes: aggs.porMes,
    por_categoria: aggs.porCat,
    top_productos: aggs.porProd
  });

  onChartEvents({
    onClickPieCategoria: (categoria)=>{
      state.categoria = (state.categoria === categoria) ? null : categoria;
      refresh();
    },
    onClickBarProducto: (producto)=>{
      state.producto = (state.producto === producto) ? null : producto;
      refresh();
    },
    onClickLineMes: (mes)=>{
      state.mes = (state.mes === mes) ? null : mes;
      refresh();
    }
  });

  initMap(geo, {
    onRegionSelected: (regionName)=>{
      const key = regionKey(regionName);
      if (state.region === key) {
        state.region = null;
        state.regionOriginal = null;
      } else {
        state.region = key;                // clave normalizada para filtrar
        state.regionOriginal = regionName; // nombre tal cual muestra el mapa (para UI)
      }
      refresh();
    }
  });

  updateMap(aggs.porReg, state.region);

  // Botones
  document.getElementById("btnReset")?.addEventListener("click", clearFilters);
  document.getElementById("btnCsv")?.addEventListener("click", exportCSV);
  document.getElementById("btnPdf")?.addEventListener("click", exportPDF);
})();