export type Sector = {
  name: string;
  designations: string[];
};

/** The one designation open to every sector, and to an employee with none. */
export const INTERN = "Intern";

/**
 * Sectors an employee can work in, each with its designations. Designation
 * names are unique across sectors, so a designation alone identifies its
 * sector (and its base price).
 */
export const SECTORS: Sector[] = [
  {
    name: "Creative & Design",
    designations: [
      "Designer",
      "Senior Designer",
      "Design Lead",
      "Design Manager",
      "Creative Director",
      "Video & Motion Designer",
      "UX Specialist",
      "Illustrator",
    ],
  },
  {
    name: "Technology & Engineering",
    designations: [
      "Junior Engineer",
      "Software Engineer",
      "Senior Engineer",
      "Lead Engineer",
      "Engineering Manager",
      "Software Architect",
      "QA Engineer",
      "DevOps Engineer",
      "Data Engineer",
      "IT Support Specialist",
    ],
  },
  {
    name: "Digital Marketing",
    designations: [
      "Marketing Executive",
      "SEO Specialist",
      "Performance Marketing Specialist",
      "Social Media Specialist",
      "Content Specialist",
      "Marketing Analyst",
      "Marketing Strategist",
      "Marketing Manager",
      "Growth Marketing Lead",
      "Marketing Director",
    ],
  },
  {
    name: "Business & Operations",
    designations: [
      "Business Executive",
      "Business Analyst",
      "Business Development Executive",
      "Business Development Manager",
      "Project Coordinator",
      "Project Manager",
      "Product Manager",
      "Operations Manager",
      "Business Manager",
      "Strategy Consultant",
    ],
  },
  {
    name: "Executive Management",
    designations: [
      "Team Lead",
      "Assistant Manager",
      "Manager",
      "Senior Manager",
      "Head of Department",
      "General Manager",
      "Director",
      "Vice President",
      "C-Level Executive",
      "Managing Director",
    ],
  },
  {
    name: "Human Resources",
    designations: [
      "HR Executive",
      "HR Specialist",
      "HR Manager",
      "HR Lead",
    ],
  },
  {
    name: "Finance & Accounting",
    designations: [
      "Accountant",
      "Finance Analyst",
      "Finance Manager",
      "Financial Controller",
    ],
  },
  {
    name: "Sales",
    designations: [
      "Sales Executive",
      "Sales Specialist",
      "Account Manager",
      "Sales Manager",
    ],
  },
  {
    name: "Customer Support",
    designations: [
      "Support Executive",
      "Support Specialist",
      "Support Lead",
      "Support Manager",
    ],
  },
  {
    name: "Data & Analytics",
    designations: [
      "Data Analyst",
      "Senior Analyst",
      "Data Scientist",
      "Analytics Lead",
    ],
  },
  {
    name: "Media Production",
    designations: [
      "Photographer",
      "Videographer",
      "Video Editor",
      "Producer",
    ],
  },
  {
    name: "Administration",
    designations: [
      "Admin Executive",
      "Office Manager",
      "Facilities Manager",
    ],
  },
  {
    name: "Legal & Compliance",
    designations: [
      "Legal Executive",
      "Legal Counsel",
      "Compliance Specialist",
      "Compliance Manager",
    ],
  },
];

export const SECTOR_OPTIONS = SECTORS.map((sector) => sector.name);

/** Every designation, Intern first, then sector by sector. */
export const DESIGNATION_OPTIONS = [
  INTERN,
  ...SECTORS.flatMap((sector) => sector.designations),
];

export function isSector(value: string) {
  return SECTOR_OPTIONS.includes(value);
}

export function isDesignation(value: string) {
  return DESIGNATION_OPTIONS.includes(value);
}

/** Designations to offer for a sector; Intern alone when none is chosen. */
export function getSectorDesignations(sector: string) {
  const match = SECTORS.find((item) => item.name === sector);
  return [INTERN, ...(match?.designations ?? [])];
}

export function isDesignationInSector(designation: string, sector: string) {
  return getSectorDesignations(sector).includes(designation);
}
