let charts = { line:null, bar:null, pie:null };
let handlers = { onClickPieCategoria:null, onClickBarProducto:null, onClickLineMes:null };
let currentSelectedCategory = null; // Rastrear la categoría seleccionada

// Mapeo de colores por categoría
const categoryColors = {
  'Ropa': '#a855f7',           // Púrpura
  'Alimentos': '#d946ef',      // Magenta/Rosa
  'Electrónica': '#4F46E5',    // Índigo
  'Hogar': '#0EA5E9'           // Azul cielo
};

// Obtener color para una categoría
function getCategoryColor(categoria) {
  return categoryColors[categoria] || '#64748B';
}

// Función para actualizar colores del bar chart cuando se selecciona una categoría
export function highlightBarByCategory(selectedCategoria){
  currentSelectedCategory = selectedCategoria;
  if(!charts.bar) return;
  
  const barData = charts.bar.data;
  const newColors = barData.labels.map((producto, idx) => {
    const productoData = charts.bar.data.productoCategories?.[idx];
    const color = getCategoryColor(productoData || 'Electrónica');
    
    // Si hay categoría seleccionada y este producto es DE esa categoría, mostrar color brillante
    // Si hay categoría seleccionada y este producto NO es de esa categoría, oscurecer
    // Si no hay categoría seleccionada, mostrar todos en color brillante
    if(selectedCategoria && productoData === selectedCategoria){
      return color; // Color brillante para productos de la categoría seleccionada
    } else if(selectedCategoria){
      return 'rgba(100, 116, 139, 0.4)'; // gris para productos de otras categorías
    }
    return color; // Color brillante cuando no hay selección
  });
  
  barData.datasets[0].backgroundColor = newColors;
  charts.bar.update();
}

export function onChartEvents(h){
  handlers = { ...handlers, ...h };
}

function commonOptions(){
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins:{
      legend:{
        labels:{ color:'#e5e7eb' }
      }
    },
    scales:{
      x:{
        ticks:{ color:'#94a3b8' },
        grid:{ color:'rgba(255,255,255,.05)' }
      },
      y:{
        ticks:{ color:'#94a3b8' },
        grid:{ color:'rgba(255,255,255,.05)' }
      }
    }
  };
}

export function initCharts(data){

  /* ========= LINE ========= */
  const ctxLine = document.getElementById('lineChart');
  charts.line = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels: data.por_mes.map(x => x.mes),
      datasets: [{
        label:`Ventas (${data.moneda})`,
        data: data.por_mes.map(x => x.ventas),
        borderColor:'#0ea5e9',
        backgroundColor:'rgba(14,165,233,.15)',
        fill:true,
        tension:.4,
        pointRadius:4,
        pointBackgroundColor:'#0ea5e9',
        pointBorderColor:'#ffffff',
        pointBorderWidth:2
      }]
    },
    options: {
      ...commonOptions(),
      onClick: (evt, elements, chart)=>{
        const point = chart.getElementsAtEventForMode(evt, 'nearest', { intersect:true }, true)[0];
        if(point){
          const mes = chart.data.labels[point.index];
          handlers.onClickLineMes && handlers.onClickLineMes(mes);
        }
      }
    }
  });

  /* ========= BAR ========= */
  const ctxBar = document.getElementById('barChart');
  charts.bar = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: data.top_productos.map(x => x.producto),
      datasets: [{
        data: data.top_productos.map(x => x.ventas),
        backgroundColor: data.top_productos.map(x => getCategoryColor(x.categoria)),
        borderRadius:8,
        borderColor:'rgba(255,255,255,.1)',
        borderWidth:1
      }],
      productoCategories: data.top_productos.map(x => x.categoria)
    },
    options:{
      ...commonOptions(),
      plugins:{ 
        legend:{ display:false },
        tooltip: {
          callbacks: {
            label: function(context){
              const product = context.label || '';
              const value = context.formattedValue ?? context.raw;
              const cat = context.chart.data.productoCategories?.[context.dataIndex] || '';
              return `${product}: ${value} ${cat ? `(${cat})` : ''}`;
            }
          }
        }
      },
      onClick: (evt, elements, chart)=>{
        const bar = chart.getElementsAtEventForMode(evt, 'nearest', { intersect:true }, true)[0];
        if(bar){
          const producto = chart.data.labels[bar.index];
          handlers.onClickBarProducto && handlers.onClickBarProducto(producto);
        }
      }
    }
  });

  /* ========= PIE ========= */
  const ctxPie = document.getElementById('pieChart');
  charts.pie = new Chart(ctxPie, {
    type: 'pie',
    data: {
      labels: data.por_categoria.map(x => x.categoria),
      datasets: [{
        data: data.por_categoria.map(x => x.ventas),
        backgroundColor: data.por_categoria.map(x => getCategoryColor(x.categoria)),
        borderColor:'rgba(255,255,255,.1)',
        borderWidth:2
      }]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{
          position:'bottom',
          labels:{ color:'#e5e7eb' }
        }
      },
      onClick: (evt, elements, chart)=>{
        const seg = chart.getElementsAtEventForMode(evt, 'nearest', { intersect:true }, true)[0];
        if(seg){
          const categoria = chart.data.labels[seg.index];
          handlers.onClickPieCategoria && handlers.onClickPieCategoria(categoria);
        }
      }
    }
  });
}
export function updateCharts(data){
  charts.line.data.labels = data.por_mes.map(x => x.mes);
  charts.line.data.datasets[0].data = data.por_mes.map(x => x.ventas);
  charts.line.data.datasets[0].label = `Ventas (${data.moneda})`;
  charts.line.update();

  charts.bar.data.labels = data.top_productos.map(x => x.producto);
  charts.bar.data.datasets[0].data = data.top_productos.map(x => x.ventas);
  charts.bar.data.productoCategories = data.top_productos.map(x => x.categoria);
  
  // Aplicar colores respetando la categoría seleccionada
  const barColors = data.top_productos.map(x => {
    const color = getCategoryColor(x.categoria);
    // Si hay categoría seleccionada y este producto es DE esa categoría, mostrar color brillante
    if(currentSelectedCategory && x.categoria === currentSelectedCategory){
      return color;
    } 
    // Si hay categoría seleccionada y este producto NO es de esa categoría, oscurecer
    else if(currentSelectedCategory){
      return 'rgba(100, 116, 139, 0.4)';
    }
    // Si no hay categoría seleccionada, mostrar todos en color brillante
    return color;
  });
  
  charts.bar.data.datasets[0].backgroundColor = barColors;
  charts.bar.update();

  charts.pie.data.labels = data.por_categoria.map(x => x.categoria);
  charts.pie.data.datasets[0].data = data.por_categoria.map(x => x.ventas);
  charts.pie.data.datasets[0].backgroundColor = data.por_categoria.map(x => getCategoryColor(x.categoria));
  charts.pie.update();
}