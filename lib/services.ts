export const SERVICE_OPTIONS = [
  "Video Editing",
  "Digital Marketing",
  "Web Development",
  "Web Application",
  "Social Media Management",
  "Client Management",
  "Graphic Design",
  "Poster Design",
  "Other",
];

export const CLIENT_STATUS_OPTIONS = ["Active", "Inactive"];

export const DIGITAL_MARKETING = "Digital Marketing";

export const DIGITAL_MARKETING_OPTIONS = [
  "Google Ads",
  "SEO",
  "Meta Ads",
  "Email Marketing",
  "Content Marketing",
  "Other",
];

export const VIDEO_EDITING = "Video Editing";

/**
 * Every client is under client management, so it is always mapped and carries
 * no payment of its own -- it is stored with the INCLUDED payment type.
 */
export const CLIENT_MANAGEMENT = "Client Management";

export const POSTER_DESIGN = "Poster Design";

export const PERCENTAGE = "Percentage";
export const PACKAGE = "Package";
export const PER_COUNT = "Per count";
/** No amount to record: the service is part of every engagement. */
export const INCLUDED = "Included";

export const PAYMENT_TYPE_OPTIONS = [PERCENTAGE, PACKAGE, PER_COUNT];

export const BILLING_CYCLE_OPTIONS = ["Monthly", "One-time"];

/**
 * Payment types a service may be billed on. Percentage is Digital Marketing
 * only; Video Editing is billed per delivered item or as a package; Poster
 * Design is per count only; Client Management is always included and never
 * billed; every other service is package-only. The first entry is the default
 * for a new mapping.
 */
export function paymentTypesForService(service: string) {
  if (service === CLIENT_MANAGEMENT) {
    return [INCLUDED];
  }

  if (service === POSTER_DESIGN) {
    return [PER_COUNT];
  }

  if (service === DIGITAL_MARKETING) {
    return [PERCENTAGE, PACKAGE];
  }

  if (service === VIDEO_EDITING) {
    return [PER_COUNT, PACKAGE];
  }

  return [PACKAGE];
}

/**
 * Payment type to show for a service, keeping a saved value only while the
 * service still allows it. Rows written before percentage was restricted can
 * hold a percentage on a service that is now package-only, and those must not
 * seed the form with an unselectable option.
 */
export function resolvePaymentType(service: string, saved?: string | null) {
  const allowed = paymentTypesForService(service);

  return saved && allowed.includes(saved) ? saved : allowed[0];
}

/**
 * Legacy Client.services parsing, kept only to seed the client form from
 * pre-mapping data. Services were stored as a comma-separated string, and a
 * service could carry a parenthesised focus area, e.g.
 * "Digital Marketing (Google Ads)". Focus values never contain a comma, so
 * comma splitting stays safe. New writes go to the ClientService table.
 */
export function splitService(service: string) {
  const match = service.match(/^(.*?)\s*\(([^)]*)\)$/);

  if (match) {
    return { name: match[1].trim(), focus: match[2].trim() || null };
  }

  return { name: service, focus: null };
}

export function parseServices(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((service) => service.trim())
    .filter(Boolean);
}

/**
 * Stable form-field suffix for a service name, so one <form> can carry a
 * payment block per service ("paymentType-video-editing", etc.). Every entry in
 * SERVICE_OPTIONS produces a distinct key.
 */
export function serviceKey(service: string) {
  return service
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ServiceMapping = {
  service: string;
  focus: string | null;
  paymentType: string;
  percentage: number | null;
  packageAmount: number | null;
  perUnitAmount: number | null;
  billingCycle: string | null;
};

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatInr(amount: number) {
  return inrFormatter.format(amount);
}

/** Trims a percentage to at most 2 decimals without trailing zeroes: 20, 12.5. */
export function formatPercentage(value: number) {
  return `${Number(value.toFixed(2))}%`;
}

/** Human-readable payment terms for one service mapping. */
export function formatPaymentTerms(mapping: {
  paymentType: string;
  percentage: number | null;
  packageAmount: number | null;
  perUnitAmount: number | null;
  billingCycle: string | null;
}) {
  if (mapping.paymentType === INCLUDED) {
    return "Included";
  }

  if (mapping.paymentType === PERCENTAGE) {
    return mapping.percentage === null
      ? "Percentage"
      : `${formatPercentage(mapping.percentage)} (percentage)`;
  }

  if (mapping.paymentType === PER_COUNT) {
    return mapping.perUnitAmount === null
      ? "Per count"
      : `${formatInr(mapping.perUnitAmount)} (per count)`;
  }

  if (mapping.paymentType === PACKAGE) {
    if (mapping.packageAmount === null) {
      return "Package";
    }

    const amount = formatInr(mapping.packageAmount);

    return mapping.billingCycle
      ? `${amount} (${mapping.billingCycle.toLowerCase()} package)`
      : `${amount} (package)`;
  }

  return mapping.paymentType;
}

/** Label for a mapping, focus area included: "Digital Marketing (SEO)". */
export function formatServiceLabel(mapping: {
  service: string;
  focus: string | null;
}) {
  return mapping.focus
    ? `${mapping.service} (${mapping.focus})`
    : mapping.service;
}
