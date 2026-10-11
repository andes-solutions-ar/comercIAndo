import './styles.css';
import { PLAN_IDS, PLANS, FEATURES, planHasFeature } from './config/plans.js';

const app = document.querySelector('#app');
let activePlanId = PLAN_IDS.START;

const featureLabels = {
  [FEATURES.CATALOG]: 'Página / tienda / catálogo',
  [FEATURES.ADMIN_PANEL]: 'Panel administrativo',
  [FEATURES.PRODUCTS_SERVICES]: 'Productos o servicios',
  [FEATURES.SALES_ORDERS_RESERVATIONS]: 'Ventas, pedidos y/o reservas',
  [FEATURES.STOCK_BASIC]: 'Stock Básico',
  [FEATURES.STOCK_PRO]: 'Stock Pro',
  [FEATURES.SECURE_DELIVERY]: 'Entrega segura',
  [FEATURES.PAYMENT_GATEWAY]: 'Pasarela de pagos',
  [FEATURES.POS]: 'Punto de venta',
  [FEATURES.STAFF_SHIFTS]: 'Nómina y turnos',
  [FEATURES.QUOTES]: 'Presupuestos y cotizaciones',
};

function render() {
  const plan = PLANS[activePlanId];
  const premiumModuleCopy = plan.optionalBusinessModules
    ? `<p class="note">Premium permite elegir 1 módulo empresarial: Nómina y turnos <strong>o</strong> Presupuestos y cotizaciones.</p>`
    : '';

  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div>
          <div class="brand">comerc<span>IA</span>ndo</div>
          <p>Andes Solutions · Base SaaS generalista</p>
        </div>
        <div class="plan-switcher" aria-label="Cambiar plan de demostración">
          ${Object.values(PLANS).map(item => `
            <button class="plan-button ${item.id === activePlanId ? 'active' : ''}" data-plan="${item.id}">
              ${item.name}
            </button>
          `).join('')}
        </div>
      </header>

      <section class="hero">
        <div>
          <p class="eyebrow">PLAN ACTIVO</p>
          <h1>${plan.name}</h1>
          <p class="price">USD ${plan.priceUsdMonthly}<span>/mes</span></p>
          <p class="description">Una misma plataforma, con capacidades habilitadas según el nivel contratado.</p>
        </div>
        <div class="summary">
          <span>Usuarios administrativos</span>
          <strong>Hasta ${plan.maxAdminUsers}</strong>
        </div>
      </section>

      <section class="content-grid">
        <article class="panel">
          <h2>Capacidades incluidas</h2>
          <div class="feature-list">
            ${Object.values(FEATURES).map(feature => {
              const enabled = planHasFeature(activePlanId, feature);
              const optional = plan.optionalBusinessModules?.includes(feature);
              if (!enabled && !optional) return '';
              return `
                <div class="feature-row ${optional ? 'optional' : ''}">
                  <span>${featureLabels[feature]}</span>
                  <strong>${optional ? 'A elección' : 'Incluido'}</strong>
                </div>
              `;
            }).join('')}
          </div>
          ${premiumModuleCopy}
        </article>

        <aside class="panel rules">
          <h2>Reglas de producto</h2>
          <p><strong>START / COMMERCE:</strong> Stock Básico.</p>
          <p><strong>PREMIUM:</strong> Stock Pro + entrega segura + POS.</p>
          <p>No se habilitan módulos fuera del alcance aprobado.</p>
          <p>Andes Gastro y Andes Gastro Pro pertenecen a otra familia de productos.</p>
        </aside>
      </section>
    </main>
  `;

  document.querySelectorAll('[data-plan]').forEach(button => {
    button.addEventListener('click', () => {
      activePlanId = button.dataset.plan;
      render();
    });
  });
}

render();
