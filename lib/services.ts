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

/**
 * Services are stored as a comma-separated string. A service may carry a
 * parenthesised focus area, e.g. "Digital Marketing (Google Ads)". Focus
 * values never contain a comma, so comma splitting stays safe.
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

/** Service names without their focus area, for matching against SERVICE_OPTIONS. */
export function getServiceNames(value: string | null) {
  return parseServices(value).map((service) => splitService(service).name);
}

export function getDigitalMarketingFocus(value: string | null) {
  for (const service of parseServices(value)) {
    const { name, focus } = splitService(service);

    if (name === DIGITAL_MARKETING) {
      return focus;
    }
  }

  return null;
}

export function serializeServices(
  services: string[],
  digitalMarketingFocus?: string | null
) {
  const allowed = services.filter((service) =>
    SERVICE_OPTIONS.includes(service)
  );

  const withFocus = allowed.map((service) => {
    if (
      service === DIGITAL_MARKETING &&
      digitalMarketingFocus &&
      DIGITAL_MARKETING_OPTIONS.includes(digitalMarketingFocus)
    ) {
      return `${DIGITAL_MARKETING} (${digitalMarketingFocus})`;
    }

    return service;
  });

  return withFocus.length > 0 ? withFocus.join(", ") : null;
}
