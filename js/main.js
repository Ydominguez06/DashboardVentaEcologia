import { initCharts, updateCharts, onChartEvents, highlightBarByCategory } from './chart.js';
import { initMap, updateMap } from './map.js';
import { startTour } from './tour.js';

let RAW = null;
const state = { region: null, regionOriginal: null, categoria: null, producto: null, mes: null };


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


// Lee detalle desde ventas.json soportando ambas claves
function getDetalle(data){
  if (!data) return [];
  if (Array.isArray(data.detalle_actualizado)) return data.detalle_actualizado;
  if (Array.isArray(data.detalle))            return data.detalle;
  console.warn('[getDetalle] No se encontró detalle ni detalle_actualizado');
  return [];
}


function withIngresos(rows){
  if (!Array.isArray(rows)) return [];
  return rows.map(r => {
    const ingresos = (r.ingresos_hnl != null)
      ? Number(r.ingresos_hnl)
      : Number(r.precio_unitario_hnl ?? 0) * Number(r.ventas ?? 0);
    return { ...r, ingresos_hnl: ingresos };
  });
}


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


function getAllMonthsFromRAW(){
  const all = getDetalle(RAW);
  const meses = Array.from(new Set(all.map(r => r.mes).filter(Boolean)))
    .sort((a,b) => String(a).localeCompare(String(b)));
  return meses;
}



function normalizeKey(str){
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') 
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}


function regionKey(name){
  const key = normalizeKey(name);
  return key.replace(/\s+DEPARTMENT$|^\s*DEPTO\.\s*/g, '');
}


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


function aggregateForCharts(rows, rowsForTopProducts = null){
  if (!Array.isArray(rows)) rows = [];

  // Datos usados para cálculos generales (mes, categorias, regiones)
  const data = withIngresos(rows);

  // Si no se pasa una colección separada para top productos,
  // usamos la misma colección; en refresh podremos pasar una
  // que ignore el filtro de categoría.
  if (!rowsForTopProducts) rowsForTopProducts = rows;
  const dataForTop = withIngresos(rowsForTopProducts);

  

    // Mostrar todos los meses del periodo, colocando 0 en los meses sin ventas
    const baseMonths = getAllMonthsFromRAW();
    const sumMes = new Map(
      groupSumBy(data, 'mes', 'ventas').map(x => [String(x.key), x.total])
    );
    const porMes = baseMonths.map(mes => ({
      mes,
      ventas: sumMes.get(mes) ?? 0
    }));

  const porCat = groupSumBy(data, 'categoria', 'ventas')
    .filter(x => x.key != null && x.key !== '')
    .map(x => ({ categoria: String(x.key), ventas: x.total }));

  // Para top productos calculamos sobre dataForTop (puede ignorar filtro de categoría)
  const prodSums = groupSumBy(dataForTop, 'producto', 'ventas')
    .filter(x => x.key != null && x.key !== '')
    .sort((a,b) => b.total - a.total);

  const porProd = prodSums.slice(0, 5).map(x => {
    const productoName = String(x.key);
    // buscar categoría del primer registro que coincida en dataForTop
    const found = dataForTop.find(r => r.producto === productoName && r.categoria);
    return { producto: productoName, ventas: x.total, categoria: found ? String(found.categoria) : null };
  });

  const porReg = groupSumBy(data, 'region', 'ventas')
    .filter(x => x.key != null && x.key !== '')
    .map(x => ({ region: String(x.key), ventas: x.total }));

  return { porMes, porCat, porProd, porReg };
}


function refresh(){
  const detalle = getDetalle(RAW);
  const filtered = applyFilters(detalle);
  // Para calcular top productos queremos respetar filtros de región/mes/producto
  // pero IGNORAR el filtro de categoría (así el bar muestra el top global dentro
  // del contexto de los demás filtros y podemos solo resaltar por categoría).
  const filteredExceptCategory = (Array.isArray(detalle)) ? detalle.filter(r =>
    (state.region    ? regionKey(r.region)    === state.region    : true) &&
    (state.producto  ? r.producto             === state.producto  : true) &&
    (state.mes       ? r.mes                  === state.mes       : true)
  ) : [];

  // Si hay una categoría seleccionada, queremos que el bar muestre
  // el top productos DENTRO de esa categoría. Si NO hay categoría,
  // calculamos el top global (ignorando categoría) para que el bar
  // presente los productos más vendidos en el contexto de otros filtros.
  const rowsForTop = state.categoria ? filtered : filteredExceptCategory;
  const aggs = aggregateForCharts(filtered, rowsForTop);

  document.getElementById('filtrosActivos').textContent = describeFilters();

  updateCharts({
    moneda: RAW?.resumen?.moneda || 'HNL',
    por_mes: aggs.porMes,
    por_categoria: aggs.porCat,
    top_productos: aggs.porProd
  });

  
  updateMap(aggs.porReg, state.region);
  // Asegurar que los colores del bar respeten la categoría actualmente seleccionada
  try{ highlightBarByCategory(state.categoria); }catch(e){}
}


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

  
  cards.forEach((card, index) => {
    card.style.background = originalStyles[index].background;
    card.style.color = originalStyles[index].color;
    card.querySelectorAll("*").forEach(el => { el.style.color = ""; });
  });

  pdf.save("Dashboard_Ventas.pdf");
}


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
      highlightBarByCategory(state.categoria);
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
        state.region = key;                
        state.regionOriginal = regionName; 
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