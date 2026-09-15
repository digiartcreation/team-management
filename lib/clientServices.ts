import {
  BILLING_CYCLE_OPTIONS,
  DIGITAL_MARKETING,
  DIGITAL_MARKETING_OPTIONS,
  PACKAGE,
  PERCENTAGE,
  PER_COUNT,
  SERVICE_OPTIONS,
  parseServices,
  paymentTypesForService,
  resolvePaymentType,
  serviceKey,
  splitService,
  type ServiceMapping,
} from "@/lib/services";

/** Shape of a ClientService row as selected from Prisma. */
type ClientServiceRow = {
  service: string;
  focus: string | null;
  paymentType: string;
  percentage: unknown;
  packageAmount: unknown;
  perUnitAmount: unknown;
  billingCycle: string | null;
};

/**
 * Prisma returns DECIMAL columns as Decimal objects, which cannot cross into a
 * client component. Convert to a plain number at the boundary.
 */
function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value.toString());

  return Number.isFinite(parsed) ? parsed : null;
}

export function toServiceMapping(row: ClientServiceRow): ServiceMapping {
  return {
    service: row.service,
    focus: row.focus,
    paymentType: row.paymentType,
    percentage: decimalToNumber(row.percentage),
    packageAmount: decimalToNumber(row.packageAmount),
    perUnitAmount: decimalToNumber(row.perUnitAmount),
    billingCycle: row.billingCycle,
  };
}

export function toServiceMappings(rows: ClientServiceRow[]) {
  return rows.map(toServiceMapping);
}

/**
 * Seeds the edit form from the legacy comma-separated Client.services text, for
 * clients created before payment mapping existed. Payment values are left blank
 * on purpose rather than invented -- the form requires them before saving.
 */
export function seedMappingsFromLegacy(services: string | null) {
  return parseServices(services)
    .map((entry) => splitService(entry))
    .filter((entry) => SERVICE_OPTIONS.includes(entry.name))
    .map<ServiceMapping>((entry) => ({
      service: entry.name,
      focus: entry.name === DIGITAL_MARKETING ? entry.focus : null,
      paymentType: resolvePaymentType(entry.name),
      percentage: null,
      packageAmount: null,
      perUnitAmount: null,
      billingCycle: null,
    }));
}

function getField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseAmount(raw: string, label: string, service: string) {
  const value = Number(raw);

  if (!raw || !Number.isFinite(value)) {
    throw new Error(`Enter the ${label} for ${service}.`);
  }

  return value;
}

/**
 * Reads one payment block per ticked service out of the client form. Field names
 * are suffixed with serviceKey(service), matching components/clients/ServicesField.
 */
export function parseServiceMappings(formData: FormData): ServiceMapping[] {
  const selected = formData
    .getAll("services")
    .filter((value): value is string => typeof value === "string")
    .filter((service) => SERVICE_OPTIONS.includes(service));

  // De-duplicate: ClientService is unique on (clientId, service).
  const services = [...new Set(selected)];

  return services.map((service) => {
    const key = serviceKey(service);
    const paymentType = getField(formData, `paymentType-${key}`);

    // Percentage is Digital Marketing only and per count is Video Editing only,
    // so the allowed set is per service rather than global.
    if (!paymentTypesForService(service).includes(paymentType)) {
      throw new Error(`Select a valid payment type for ${service}.`);
    }

    let focus: string | null = null;

    if (service === DIGITAL_MARKETING) {
      const rawFocus = getField(formData, `focus-${key}`);

      if (!DIGITAL_MARKETING_OPTIONS.includes(rawFocus)) {
        throw new Error(`Select a focus area for ${service}.`);
      }

      focus = rawFocus;
    }

    if (paymentType === PERCENTAGE) {
      const percentage = parseAmount(
        getField(formData, `percentage-${key}`),
        "percentage",
        service
      );

      if (percentage <= 0 || percentage > 100) {
        throw new Error(`Percentage for ${service} must be between 0 and 100.`);
      }

      return {
        service,
        focus,
        paymentType,
        percentage,
        packageAmount: null,
        perUnitAmount: null,
        billingCycle: null,
      };
    }

    if (paymentType === PER_COUNT) {
      const perUnitAmount = parseAmount(
        getField(formData, `perUnitAmount-${key}`),
        "rate per count",
        service
      );

      if (perUnitAmount <= 0) {
        throw new Error(
          `Rate per count for ${service} must be more than 0.`
        );
      }

      return {
        service,
        focus,
        paymentType,
        percentage: null,
        packageAmount: null,
        perUnitAmount,
        billingCycle: null,
      };
    }

    const packageAmount = parseAmount(
      getField(formData, `packageAmount-${key}`),
      "package amount",
      service
    );

    if (packageAmount <= 0) {
      throw new Error(`Package amount for ${service} must be more than 0.`);
    }

    const billingCycle = getField(formData, `billingCycle-${key}`);

    if (!BILLING_CYCLE_OPTIONS.includes(billingCycle)) {
      throw new Error(`Select a billing cycle for ${service}.`);
    }

    return {
      service,
      focus,
      paymentType: PACKAGE,
      percentage: null,
      packageAmount,
      perUnitAmount: null,
      billingCycle,
    };
  });
}
