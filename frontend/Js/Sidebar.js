(function () {
  const navMap = {
    'auditor-dashboard.html': {
      'dashboard': { type: 'scroll', selector: '#sectionDashboard' },
      'cola de revision': { type: 'scroll', selector: '#sectionColaRevision' },
      'empresas': { type: 'tab', selector: '#tab-empresas' },
      'reportes': { type: 'tab', selector: '#tab-historial' }
    },
    'superadmin-dashboard.html': {
      'dashboard': { type: 'scroll', selector: '#sectionDashboard' },
      'usuarios': { type: 'tab', selector: '#tab-usuarios' },
      'documentos': { type: 'tab', selector: '#tab-documentos' },
      'auditoria': { type: 'scroll', selector: '#sectionAuditoria' }
    },
    'usuario-dashboard.html': {
      'inicio': { type: 'scroll', selector: '#sectionInicio' },
      'mis documentos': { type: 'scroll', selector: '#sectionDocumentos' },
      'soporte': { type: 'scroll', selector: '#sectionSoporte' }
    }
  };

  function normalize(text) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function scrollToElement(selector) {
    const target = document.querySelector(selector);
    if (!target) return false;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  function activateTab(tabName) {
    if (!tabName) return;
    if (typeof window.switchTab === 'function') {
      window.switchTab(tabName);
      return;
    }

    const buttons = Array.from(document.querySelectorAll('.pill'));
    const tabButton = buttons.find((btn) => {
      const onclick = btn.getAttribute('onclick') || '';
      return onclick.includes(`switchTab('${tabName}'`) || onclick.includes(`switchTab("${tabName}"`);
    });

    if (tabButton) {
      tabButton.click();
    }
  }

  function handleNavigation(label) {
    const page = window.location.pathname.split('/').pop();
    const map = navMap[page] || {};
    const key = normalize(label);
    const item = map[key];
    if (!item) return;

    switch (item.type) {
      case 'scroll':
        if (!scrollToElement(item.selector)) {
          console.warn(`Sidebar navigation target not found: ${item.selector}`);
        }
        break;
      case 'tab':
        const tabName = String(item.selector || '').replace('#tab-', '');
        activateTab(tabName);
        if (!scrollToElement(item.selector)) {
          console.warn(`Sidebar tab target not found: ${item.selector}`);
        }
        break;
      case 'link':
        if (item.url) {
          window.location.href = item.url;
        }
        break;
      default:
        break;
    }
  }

  function initSidebar() {
    const navItems = document.querySelectorAll('.sidebar .nav-item');
    if (!navItems.length) return;

    navItems.forEach((item) => {
      item.style.cursor = 'pointer';
      item.addEventListener('click', (event) => {
        navItems.forEach((nav) => nav.classList.remove('is-active'));
        item.classList.add('is-active');
        handleNavigation(item.textContent || item.innerText || '');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', initSidebar);
})();
