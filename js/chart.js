let charts = { line:null, bar:null, pie:null };
let handlers = { onClickPieCategoria:null, onClickBarProducto:null, onClickLineMes:null };

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
        borderColor:'#22c55e',
        backgroundColor:'rgba(34,197,94,.15)',
        fill:true,
        tension:.4,
        pointRadius:4
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
        backgroundColor:['#38bdf8','#f472b6','#f59e0b','#22c55e','#a78bfa'],
        borderRadius:8
      }]
    },
    options:{
      ...commonOptions(),
      plugins:{ legend:{ display:false } },
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
        backgroundColor:['#10b981','#06b6d4','#f59e0b','#ef4444'],
        borderWidth:0
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
  charts.bar.update();

  charts.pie.data.labels = data.por_categoria.map(x => x.categoria);
  charts.pie.data.datasets[0].data = data.por_categoria.map(x => x.ventas);
  charts.pie.update();
}