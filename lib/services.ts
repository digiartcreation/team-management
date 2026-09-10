export const SERVICE_OPTIONS = [
  "Video Editing",
  "Digital Marketing",
  "Web Development",
  "Web Application",
  "Social Media Management",
  "Client Management",
  "Graphic Design",
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

export const PAYMENT_TYPE_OPTIONS = ["Percentage", "Package"];

export const PERCENTAGE = "Percentage";
export const PACKAGE = "Package";

export const BILLING_CYCLE_OPTIONS = ["Monthly", "One-time"];

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
  billingCycle: string | null;
}) {
  if (mapping.paymentType === PERCENTAGE) {
    return mapping.percentage === null
      ? "Percentage"
      : `${formatPercentage(mapping.percentage)} (percentage)`;
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
