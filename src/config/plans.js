export const PLAN_IDS = Object.freeze({
  START: 'start',
  COMMERCE: 'commerce',
  PREMIUM: 'premium',
});

export const FEATURES = Object.freeze({
  CATALOG: 'catalog',
  ADMIN_PANEL: 'admin_panel',
  PRODUCTS_SERVICES: 'products_services',
  SALES_ORDERS_RESERVATIONS: 'sales_orders_reservations',
  STOCK_BASIC: 'stock_basic',
  STOCK_PRO: 'stock_pro',
  SECURE_DELIVERY: 'secure_delivery',
  PAYMENT_GATEWAY: 'payment_gateway',
  POS: 'pos',
  STAFF_SHIFTS: 'staff_shifts',
  QUOTES: 'quotes',
});

export const PLANS = Object.freeze({
  [PLAN_IDS.START]: {
    id: PLAN_IDS.START,
    name: 'START',
    priceUsdMonthly: 100,
    maxAdminUsers: 1,
    features: [
      FEATURES.CATALOG,
      FEATURES.ADMIN_PANEL,
      FEATURES.PRODUCTS_SERVICES,
      FEATURES.SALES_ORDERS_RESERVATIONS,
      FEATURES.STOCK_BASIC,
    ],
  },
  [PLAN_IDS.COMMERCE]: {
    id: PLAN_IDS.COMMERCE,
    name: 'COMMERCE',
    priceUsdMonthly: 150,
    maxAdminUsers: 3,
    features: [
      FEATURES.CATALOG,
      FEATURES.ADMIN_PANEL,
      FEATURES.PRODUCTS_SERVICES,
      FEATURES.SALES_ORDERS_RESERVATIONS,
      FEATURES.STOCK_BASIC,
      FEATURES.PAYMENT_GATEWAY,
    ],
  },
  [PLAN_IDS.PREMIUM]: {
    id: PLAN_IDS.PREMIUM,
    name: 'PREMIUM',
    priceUsdMonthly: 250,
    maxAdminUsers: 3,
    features: [
      FEATURES.CATALOG,
      FEATURES.ADMIN_PANEL,
      FEATURES.PRODUCTS_SERVICES,
      FEATURES.SALES_ORDERS_RESERVATIONS,
      FEATURES.STOCK_PRO,
      FEATURES.SECURE_DELIVERY,
      FEATURES.PAYMENT_GATEWAY,
      FEATURES.POS,
    ],
    optionalBusinessModules: [FEATURES.STAFF_SHIFTS, FEATURES.QUOTES],
    maxOptionalBusinessModules: 1,
  },
});

export function getPlan(planId) {
  return PLANS[planId] ?? null;
}

export function planHasFeature(planId, feature) {
  const plan = getPlan(planId);
  return Boolean(plan?.features.includes(feature));
}

export function canUseBusinessModule(planId, module) {
  const plan = getPlan(planId);
  return Boolean(plan?.optionalBusinessModules?.includes(module));
}
