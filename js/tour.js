
function makeRectFor(el) {
  const r = el.getBoundingClientRect();
  return { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height };
}

function placeAround(targetRect, tooltipEl, preferred = 'bottom-left', gap = 12) {
  
  const { innerWidth, innerHeight, scrollX, scrollY } = window;
  tooltipEl.style.visibility = 'hidden';
  tooltipEl.style.left = '-9999px'; // medir primero
  tooltipEl.style.top  = '-9999px';
  tooltipEl.style.display = 'block';
  const tw = tooltipEl.offsetWidth;
  const th = tooltipEl.offsetHeight;
  tooltipEl.style.display = '';

  let left = targetRect.left;
  let top  = targetRect.top + targetRect.height + gap;

  
  if (left + tw > scrollX + innerWidth - 12) {
    left = Math.max(12, scrollX + innerWidth - tw - 12);
  }
 
  if (top + th > scrollY + innerHeight - 12) {
    
    const up = targetRect.top - th - gap;
    if (up >= scrollY + 12) {
      top = up;
      
      tooltipEl.style.setProperty('--arrow-direction', 'up');
      tooltipEl.classList.add('up-arrow');
    }
  }

  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top  = `${top}px`;
  tooltipEl.style.visibility = 'visible';
}

function createEl(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

export function startTour() {
  
  const steps = [
    {
      target: '#map',
      title: 'Mapa: ventas por región',
      content: 'Pasa el mouse o haz clic para ver/filtrar por departamento. Vuelve a hacer clic para limpiar la selección.'
    },
    {
      target: '#lineChart',
      title: 'Tendencia mensual',
      content: 'Haz clic en un punto de la línea para filtrar por mes. Observa la evolución de ventas a lo largo del año.'
    },
    {
      target: '#barChart',
      title: 'Top productos',
      content: 'Haz clic en una barra para filtrar por producto. Aquí ves los 5 más vendidos según el filtro actual.'
    },
    {
      target: '#pieChart',
      title: 'Participación por categoría',
      content: 'Haz clic en un segmento para filtrar por categoría y ver cómo cambia el resto del dashboard.'
    },
    {
      target: '#btnCsv',
      title: 'Exportar CSV',
      content: 'Exporta el dataset actualmente filtrado a un archivo CSV.'
    },
    {
      target: '#btnPdf',
      title: 'Exportar PDF',
      content: 'Genera un PDF con capturas de las cards principales (mapa y charts).'
    },
    {
      target: '#btnReset',
      title: 'Limpiar filtros',
      content: 'Vuelve a la vista general sin filtros.'
    }
  ];

  
  const validSteps = steps.filter(s => document.querySelector(s.target));
  if (!validSteps.length) {
    alert('No hay elementos disponibles para el tour.');
    return;
  }

  const backdrop = createEl('div', 'tour-backdrop');
  const highlight = createEl('div', 'tour-highlight');
  const tooltip = createEl('div', 'tour-tooltip');

  let idx = 0;

  function setStep(i) {
    idx = i;
    const s = validSteps[idx];
    const el = document.querySelector(s.target);

    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    
    const rect = makeRectFor(el);
    highlight.style.top = rect.top - 8 + 'px';
    highlight.style.left = rect.left - 8 + 'px';
    highlight.style.width = rect.width + 16 + 'px';
    highlight.style.height = rect.height + 16 + 'px';

    tooltip.innerHTML = `
      <div style="font-weight:600; margin-bottom:6px;">${s.title}</div>
      <div>${s.content}</div>
      <div class="tour-actions">
        <button class="tour-btn" id="tourPrev" ${idx===0 ? 'disabled' : ''}>Anterior</button>
        <button class="tour-btn" id="tourSkip">Saltar</button>
        <button class="tour-btn primary" id="tourNext">${idx===validSteps.length-1 ? 'Finalizar' : 'Siguiente'}</button>
      </div>
    `;

    
    placeAround(rect, tooltip, 'bottom-left', 14);


    tooltip.querySelector('#tourPrev').onclick = () => setStep(Math.max(0, idx - 1));
    tooltip.querySelector('#tourNext').onclick = () => {
      if (idx >= validSteps.length - 1) endTour();
      else setStep(idx + 1);
    };
    tooltip.querySelector('#tourSkip').onclick = endTour;
  }

  function endTour() {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onResize, true);
    [backdrop, highlight, tooltip].forEach(el => el.remove());
  }

  function onResize() {

    setStep(idx);
  }

  document.body.appendChild(backdrop);
  document.body.appendChild(highlight);
  document.body.appendChild(tooltip);

  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onResize, true);

  setStep(0);
}