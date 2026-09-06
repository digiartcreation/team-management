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

export function parseServices(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((service) => service.trim())
    .filter(Boolean);
}

export function serializeServices(services: string[]) {
  const allowed = services.filter((service) =>
    SERVICE_OPTIONS.includes(service)
  );

  return allowed.length > 0 ? allowed.join(", ") : null;
}
