"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/layout/LogoutButton";
import PushNotificationToggle from "@/components/notifications/PushNotificationToggle";

type NavItem = {
  label: string;
  href: string;
};

type SidebarNavProps = {
  items: NavItem[];
  unreadNotifications?: number;
  alertCounts?: Record<string, number | undefined>;
  /** Calendar entries today (green) and tomorrow (gray), beside Calendar. */
  calendarCounts?: { today: number; tomorrow: number };
};

export default function SidebarNav({
  items,
  unreadNotifications = 0,
  alertCounts = {},
  calendarCounts,
}: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex max-w-full gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition duration-200 ${
              isActive
                ? "bg-[#6B1BBD] text-white shadow-sm"
                : "text-[#4B5563] hover:bg-[#F3E8FF] hover:text-[#770FC2]"
            }`}
          >
            <span>{item.label}</span>
            {alertCounts[item.href] ? (
              <span className="ml-2 rounded-full bg-[#F3E8FF] px-2 py-0.5 text-xs text-[#770FC2]">
                {alertCounts[item.href]}
              </span>
            ) : null}
            {/* Both show once either has something, so green is always today
                and gray tomorrow, in that order. */}
            {item.href === "/calendar" &&
            calendarCounts &&
            (calendarCounts.today > 0 || calendarCounts.tomorrow > 0) ? (
              <span className="ml-2 inline-flex gap-1">
                <span
                  title={`${calendarCounts.today} today`}
                  className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white"
                >
                  {calendarCounts.today}
                  <span className="sr-only"> today</span>
                </span>
                <span
                  title={`${calendarCounts.tomorrow} tomorrow`}
                  className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700"
                >
                  {calendarCounts.tomorrow}
                  <span className="sr-only"> tomorrow</span>
                </span>
              </span>
            ) : null}
            {item.href === "/notifications" && unreadNotifications > 0 ? (
              <span className="ml-2 rounded-full bg-[#A05DD0] px-2 py-0.5 text-xs text-white">
                {unreadNotifications}
              </span>
            ) : null}
          </Link>
        );
      })}
      <div className="flex flex-col gap-2 pt-2 lg:mt-2">
        <PushNotificationToggle compact />
        <div className="min-w-fit pl-3">
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}
