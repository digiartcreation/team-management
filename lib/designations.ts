/** Job levels an employee can hold, lowest first. */
export const DESIGNATION_OPTIONS = [
  "Intern",
  "Junior Engineer",
  "Engineer",
  "Senior Engineer",
];

export function isDesignation(value: string) {
  return DESIGNATION_OPTIONS.includes(value);
}
