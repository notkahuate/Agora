/**
 * Estructura SG-SST (Res. 0312) — categorías principales y subcategorías con peso.
 */
const PESO_TOTAL_SGSST = 100;
const TOLERANCIA_PESO = 0.05;

const SG_SST_CATEGORIAS = [
  {
    id: '1',
    nombre: 'RECURSOS',
    peso: 10,
    subcategorias: [
      { id: '1.1', nombre: 'Recursos financieros, técnicos, humanos y de otra índole', peso: 4 },
      { id: '1.2', nombre: 'Capacitación en el SG-SST', peso: 6 }
    ]
  },
  {
    id: '2',
    nombre: 'GESTIÓN INTEGRAL DEL SG-SST',
    peso: 15,
    subcategorias: [
      { id: '2.1', nombre: 'Política de Seguridad y Salud en el Trabajo', peso: 1 },
      { id: '2.2', nombre: 'Objetivos del SG-SST', peso: 1 },
      { id: '2.3', nombre: 'Evaluación inicial del SG-SST', peso: 1 },
      { id: '2.4', nombre: 'Plan Anual de Trabajo', peso: 2 },
      { id: '2.5', nombre: 'Conservación de la documentación', peso: 2 },
      { id: '2.6', nombre: 'Rendición de cuentas', peso: 1 },
      { id: '2.7', nombre: 'Normatividad nacional vigente y aplicable', peso: 2 },
      { id: '2.8', nombre: 'Comunicación', peso: 1 },
      { id: '2.9', nombre: 'Adquisiciones', peso: 1 },
      { id: '2.10', nombre: 'Contratación', peso: 2 },
      { id: '2.11', nombre: 'Gestión del cambio', peso: 1 }
    ]
  },
  {
    id: '3',
    nombre: 'GESTIÓN DE LA SALUD',
    peso: 20,
    subcategorias: [
      { id: '3.1', nombre: 'Condiciones de salud en el trabajo', peso: 9 },
      { id: '3.2', nombre: 'Registro, reporte e investigación de enfermedades, incidentes y accidentes', peso: 5 },
      { id: '3.3', nombre: 'Mecanismos de vigilancia de las condiciones de salud', peso: 6 }
    ]
  },
  {
    id: '4',
    nombre: 'GESTIÓN DE PELIGROS Y RIESGOS',
    peso: 30,
    subcategorias: [
      { id: '4.1', nombre: 'Identificación de peligros, evaluación y valoración de riesgos', peso: 15 },
      { id: '4.2', nombre: 'Medidas de prevención y control para intervenir peligros/riesgos', peso: 15 }
    ]
  },
  {
    id: '5',
    nombre: 'GESTIÓN DE AMENAZAS',
    peso: 10,
    subcategorias: [
      { id: '5.1', nombre: 'Plan de prevención, preparación y respuesta ante emergencias', peso: 10 }
    ]
  },
  {
    id: '6',
    nombre: 'VERIFICACIÓN DEL SG-SST',
    peso: 5,
    subcategorias: [
      { id: '6.1', nombre: 'Gestión y resultados del SG-SST', peso: 5 }
    ]
  },
  {
    id: '7',
    nombre: 'MEJORAMIENTO',
    peso: 10,
    subcategorias: [
      { id: '7.1', nombre: 'Acciones preventivas y correctivas con base en los resultados', peso: 10 }
    ]
  }
];

function obtenerSeccionSgsst(nombre) {
  const text = String(nombre || '').trim();
  const match = text.match(/^(\d+)(?:\.\d+)*/);
  return match ? match[1] : null;
}

function obtenerSubseccionSgsst(nombre) {
  const text = String(nombre || '').trim();
  const ids = SG_SST_CATEGORIAS.flatMap(c => c.subcategorias.map(s => s.id));
  const ordenados = [...ids].sort((a, b) => b.length - a.length);

  for (const id of ordenados) {
    if (text.startsWith(`${id}.`) || text.startsWith(`${id} `)) {
      return id;
    }
  }

  const match = text.match(/^(\d+\.\d+)(?:\.|\s)/);
  return match ? match[1] : null;
}

function obtenerPesoSubcategoria(subId) {
  for (const cat of SG_SST_CATEGORIAS) {
    const sub = cat.subcategorias.find(s => s.id === subId);
    if (sub) return sub.peso;
  }
  return 0;
}

function obtenerPesoCategoria(catId) {
  const cat = SG_SST_CATEGORIAS.find(c => c.id === catId);
  return cat ? cat.peso : 0;
}

function esDocumentoCompletadoSgsst(doc) {
  const estado = String(doc.estado_documento || doc.estado || 'pendiente').toLowerCase();
  return ['validado', 'revisado', 'aprobado', 'subido'].includes(estado);
}

function redondearPorcentaje(valor) {
  return Math.min(100, Math.round(valor * 10) / 10);
}

function esAsignacionCompleta(asignado, esperado = PESO_TOTAL_SGSST) {
  return Math.abs(asignado - esperado) <= TOLERANCIA_PESO;
}

/**
 * Resuelve el peso efectivo de cada documento.
 * - Con todos los documentos asignados: usa el porcentaje de cada uno.
 * - Con asignación parcial: ajusta proporcionalmente para que el total asignado sume 100%.
 */
function resolverPesosDocumentos(documentos) {
  const lista = (Array.isArray(documentos) ? documentos : []).map(doc => ({
    doc,
    nombre: doc.tipo_documento || doc.nombre || '',
    seccion: obtenerSeccionSgsst(doc.tipo_documento || doc.nombre || ''),
    subseccion: obtenerSubseccionSgsst(doc.tipo_documento || doc.nombre || ''),
    pesoOriginal: parseFloat(doc.porcentaje) || 0,
    pesoEfectivo: 0
  }));

  const porSub = {};
  lista.forEach(item => {
    if (!item.subseccion) return;
    porSub[item.subseccion] = porSub[item.subseccion] || [];
    porSub[item.subseccion].push(item);
  });

  Object.entries(porSub).forEach(([subId, items]) => {
    const pesoSub = obtenerPesoSubcategoria(subId);
    if (!pesoSub || !items.length) return;

    const sumaOriginal = items.reduce((s, i) => s + (i.pesoOriginal || 0), 0);

    if (sumaOriginal > 0) {
      const factor = pesoSub / sumaOriginal;
      items.forEach(i => { i.pesoEfectivo = i.pesoOriginal * factor; });
    } else {
      const parte = pesoSub / items.length;
      items.forEach(i => { i.pesoEfectivo = parte; });
    }
  });

  lista.forEach(item => {
    if (!item.pesoEfectivo && item.pesoOriginal) {
      item.pesoEfectivo = item.pesoOriginal;
    }
  });

  return lista;
}

function calcularPorcentajeEmpresa(ganado, asignado) {
  if (!asignado) return 0;

  if (esAsignacionCompleta(asignado)) {
    return redondearPorcentaje(Math.min(PESO_TOTAL_SGSST, ganado));
  }

  return redondearPorcentaje(Math.min(100, (ganado / asignado) * 100));
}

function calcularPorcentajeCategoria(ganado, asignado, pesoCategoria) {
  if (!asignado) return 0;

  if (esAsignacionCompleta(asignado, pesoCategoria)) {
    return redondearPorcentaje(Math.min(100, (ganado / pesoCategoria) * 100));
  }

  return redondearPorcentaje(Math.min(100, (ganado / asignado) * 100));
}

function calcularCumplimientoSgsst(documentos) {
  const items = resolverPesosDocumentos(documentos);
  const porSeccion = {};
  const porSubseccion = {};

  SG_SST_CATEGORIAS.forEach(cat => {
    porSeccion[cat.id] = {
      ganado: 0,
      asignado: 0,
      pesoEsperado: cat.peso,
      esCompleta: false
    };
    cat.subcategorias.forEach(sub => {
      porSubseccion[sub.id] = {
        ganado: 0,
        asignado: 0,
        pesoEsperado: sub.peso,
        docs: 0,
        completados: 0,
        esCompleta: false
      };
    });
  });

  let totalGanado = 0;
  let totalAsignado = 0;

  items.forEach(item => {
    const peso = item.pesoEfectivo || 0;
    if (!peso) return;

    const completado = esDocumentoCompletadoSgsst(item.doc);
    totalAsignado += peso;
    if (completado) totalGanado += peso;

    if (item.seccion && porSeccion[item.seccion]) {
      porSeccion[item.seccion].asignado += peso;
      if (completado) porSeccion[item.seccion].ganado += peso;
    }

    if (item.subseccion && porSubseccion[item.subseccion]) {
      porSubseccion[item.subseccion].asignado += peso;
      porSubseccion[item.subseccion].docs += 1;
      if (completado) {
        porSubseccion[item.subseccion].ganado += peso;
        porSubseccion[item.subseccion].completados += 1;
      }
    }
  });

  Object.entries(porSeccion).forEach(([id, stats]) => {
    stats.esCompleta = stats.asignado > 0 && esAsignacionCompleta(stats.asignado, stats.pesoEsperado);
    stats.porcentaje = calcularPorcentajeCategoria(stats.ganado, stats.asignado, stats.pesoEsperado);
    stats.contribucion = stats.ganado;
  });

  const esAsignacionTotalCompleta = esAsignacionCompleta(totalAsignado);
  const porcentajeEmpresa = calcularPorcentajeEmpresa(totalGanado, totalAsignado);

  return {
    totalGanado,
    totalAsignado,
    esAsignacionTotalCompleta,
    porcentajeEmpresa,
    porSeccion,
    porSubseccion
  };
}

window.SgsstStructure = {
  PESO_TOTAL_SGSST,
  SG_SST_CATEGORIAS,
  obtenerSeccionSgsst,
  obtenerSubseccionSgsst,
  obtenerPesoSubcategoria,
  obtenerPesoCategoria,
  esDocumentoCompletadoSgsst,
  esAsignacionCompleta,
  calcularPorcentajeEmpresa,
  calcularPorcentajeCategoria,
  calcularCumplimientoSgsst
};
