const checkAuth = () => ({ name: "John Doe" })

const user = checkAuth()
if (user) {
  const avatar = document.getElementById("userAvatar")
  if (avatar) avatar.textContent = user.name.charAt(0).toUpperCase()
}

// Obtener ID de empresa de la URL
const urlParams = new URLSearchParams(window.location.search)
const empresaId = urlParams.get("id") || 1

// Datos de empresas disponibles
const empresasData = {
  1: {
    nombre: "Constructora ABC",
    razonSocial: "Constructora ABC S.A.C",
    ruc: "20123456789",
    empleados: 24,
    sector: "Construcción",
    fecha: "15 Mar 2022",
    estado: "Activa",
    docsSubidos: 127,
    docsPendientes: 18,
    docsAprobados: 125,
    cumplimiento: "85%",
  },
  2: {
    nombre: "Minera del Sur",
    razonSocial: "Minera del Sur Ltda.",
    ruc: "20987654321",
    empleados: 45,
    sector: "Minería",
    fecha: "08 May 2020",
    estado: "Activa",
    docsSubidos: 89,
    docsPendientes: 32,
    docsAprobados: 85,
    cumplimiento: "65%",
  },
  3: {
    nombre: "Industrias XYZ",
    razonSocial: "Industrias XYZ S.A.",
    ruc: "20555666777",
    empleados: 32,
    sector: "Manufactura",
    fecha: "22 Jan 2021",
    estado: "Activa",
    docsSubidos: 145,
    docsPendientes: 5,
    docsAprobados: 140,
    cumplimiento: "95%",
  },
  4: {
    nombre: "Transportes Rápidos",
    razonSocial: "Transportes Rápidos E.I.R.L",
    ruc: "20888999000",
    empleados: 18,
    sector: "Logística",
    fecha: "30 Jun 2021",
    estado: "Activa",
    docsSubidos: 98,
    docsPendientes: 12,
    docsAprobados: 95,
    cumplimiento: "78%",
  },
}

// Cargar datos de la empresa seleccionada
function loadEmpresaData() {
  const empresa = empresasData[empresaId]

  if (empresa) {
    document.getElementById("empresaNombre").textContent = empresa.nombre
    document.getElementById("empresaRazonSocial").textContent = empresa.razonSocial
    document.getElementById("empresaRuc").textContent = empresa.ruc
    document.getElementById("empresaEmpleados").textContent = empresa.empleados
    document.getElementById("empresaSector").textContent = empresa.sector
    document.getElementById("empresaFecha").textContent = empresa.fecha
    document.getElementById("empresaEstado").textContent = empresa.estado

    document.getElementById("statSubidos").textContent = empresa.docsSubidos
    document.getElementById("statPendientes").textContent = empresa.docsPendientes
    document.getElementById("statAprobados").textContent = empresa.docsAprobados
    document.getElementById("statCumplimiento").textContent = empresa.cumplimiento
  }
}

// Función para cambiar entre tabs
function switchTab(tabName, evt) {
  document.querySelectorAll(".pill").forEach((pill) => pill.classList.remove("is-active"))
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"))

  const target = evt?.target
  if (target) target.classList.add("is-active")
  const panel = document.getElementById("tab-" + tabName)
  if (panel) panel.classList.add("active")
}

// Función para volver al dashboard del auditor
function goBack() {
  window.location.href = "auditor-dashboard.html"
}

// Cargar datos cuando se carga la página
document.addEventListener("DOMContentLoaded", loadEmpresaData)
