import Image from "next/image";
import SidebarNav from "@/components/layout/SidebarNav";

type SidebarProps = {
  role?: string;
  unreadNotifications?: number;
  alertCounts?: Record<string, number | undefined>;
};

function getNavItems(role?: string) {
  if (role === "manager") {
    return [
      { label: "Manager Dashboard", href: "/manager" },
      { label: "Tasks", href: "/tasks" },
      { label: "Attendance", href: "/attendance" },
      { label: "Daily Updates", href: "/updates" },
      { label: "Learnings", href: "/learnings" },
      { label: "AI Tools", href: "/tools" },
      { label: "Feedback Center", href: "/feedback/submissions" },
      { label: "Activity", href: "/activity" },
      { label: "Search", href: "/search" },
    ];
  }

  if (role === "member") {
    return [
      { label: "My Dashboard", href: "/member" },
      { label: "My Tasks", href: "/tasks" },
      { label: "Attendance", href: "/attendance" },
      { label: "Daily Updates", href: "/updates" },
      { label: "Learnings", href: "/learnings" },
      { label: "AI Tools", href: "/tools" },
      { label: "Feedback Center", href: "/feedback/submissions" },
      { label: "Activity", href: "/activity" },
      { label: "Search", href: "/search" },
    ];
  }

  return [
    { label: "Dashboard", href: "/" },
    { label: "Employees", href: "/employees" },
    { label: "Teams", href: "/teams" },
    { label: "Client Management", href: "/clients" },
    { label: "Tasks", href: "/tasks" },
    { label: "Attendance", href: "/attendance" },
    { label: "Daily Updates", href: "/updates" },
    { label: "Learnings", href: "/learnings" },
    { label: "AI Tools", href: "/tools" },
    { label: "Feedback Center", href: "/feedback/submissions" },
    { label: "Reports", href: "/reports" },
    { label: "Activity", href: "/activity" },
    { label: "Search", href: "/search" },
  ];
}

export default function Sidebar({
  role,
  unreadNotifications = 0,
  alertCounts = {},
}: SidebarProps) {
  const navItems = getNavItems(role);
  const dashboardTitle =
    role === "manager"
      ? "Manager Dashboard"
      : role === "member"
        ? "Employee Dashboard"
        : "Admin Dashboard";

  return (
    <aside className="flex border-b border-[#E5E7EB] bg-white text-[#1F2937] shadow-sm lg:min-h-screen lg:w-64 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex w-full flex-col gap-4 p-4 lg:p-6">
        <div className="rounded-lg border border-[#E5E7EB] bg-[#F8F7FB] p-3">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md">
              <Image
                src="/digiart-logo.jpg"
                alt="Digiart Creation logo"
                fill
                sizes="44px"
                className="object-contain"
                priority
              />
            </div>
            <div className="min-w-0">
              <p className="whitespace-nowrap text-base font-semibold leading-tight text-[#1F2937] lg:text-[15px] xl:text-base">
                Digiart Creation
              </p>
              <p className="mt-1 whitespace-nowrap text-xs font-medium text-[#6B7280]">
                {dashboardTitle}
              </p>
            </div>
          </div>
        </div>

        <SidebarNav
          items={navItems}
          unreadNotifications={unreadNotifications}
          alertCounts={alertCounts}
        />
      </div>
    </aside>
  );
}
