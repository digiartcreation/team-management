"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import LogoutButton from "@/components/layout/LogoutButton";
import PushNotificationToggle from "@/components/notifications/PushNotificationToggle";

export type NavItem = {
  label: string;
  href: string;
};

export type SidebarNavProps = {
  items: NavItem[];
  unreadNotifications?: number;
  alertCounts?: Record<string, number | undefined>;
  /** Calendar entries today (green) and tomorrow (gray), beside Calendar. */
  calendarCounts?: { today: number; tomorrow: number };
  /**
   * "sidebar" for the desktop sidebar; "drawer" for the phone menu, a plain
   * column with larger rows to tap.
   */
  variant?: "sidebar" | "drawer";
};

export default function SidebarNav({
  items,
  unreadNotifications = 0,
  alertCounts = {},
  calendarCounts,
  variant = "sidebar",
}: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const drawer = variant === "drawer";
  // Every page here is rendered per request, so the default prefetch of each
  // menu link in view cost the server one request per link on every page
  // load. Prefetching when a link is about to be used keeps clicks quick.
  // AUTO, as <Link> itself uses: only the loading skeleton. router.prefetch
  // defaults to FULL, which renders the whole page -- its queries, and the
  // menu badge marking that module reviewed -- just because of a hover.
  const prefetch = (href: string) => router.prefetch(href, { kind: PrefetchKind.AUTO });

  return (
    <nav
      className={
        drawer
          ? "flex flex-col gap-1"
          : "flex max-w-full gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
      }
    >
      {items.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            onMouseEnter={() => prefetch(item.href)}
            onFocus={() => prefetch(item.href)}
            onTouchStart={() => prefetch(item.href)}
            aria-current={isActive ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 text-sm font-medium transition duration-200 ${
              drawer ? "flex items-center py-2.5" : "py-2"
            } ${
              isActive
                ? "bg-[#6B1BBD] text-white shadow-sm"
                : "text-[#4B5563] hover:bg-[#F3E8FF] hover:text-[#770FC2]"
            }`}
          >
            <span className={drawer ? "min-w-0 flex-1 truncate" : undefined}>
              {item.label}
            </span>
            {alertCounts[item.href] ? (
              <span className="ml-2 rounded-full bg-[#F3E8FF] px-2 py-0.5 text-xs text-[#770FC2]">
                {alertCounts[item.href]}
              </span>
            ) : null}
            {/* Each shows only when it has something: green is today, gray
                tomorrow. */}
            {item.href === "/calendar" &&
            calendarCounts &&
            (calendarCounts.today > 0 || calendarCounts.tomorrow > 0) ? (
              <span className="ml-2 inline-flex gap-1">
                {calendarCounts.today > 0 ? (
                  <span
                    title={`${calendarCounts.today} today`}
                    className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white"
                  >
                    {calendarCounts.today}
                    <span className="sr-only"> today</span>
                  </span>
                ) : null}
                {calendarCounts.tomorrow > 0 ? (
                  <span
                    title={`${calendarCounts.tomorrow} tomorrow`}
                    className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700"
                  >
                    {calendarCounts.tomorrow}
                    <span className="sr-only"> tomorrow</span>
                  </span>
                ) : null}
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
      <div
        className={
          drawer
            ? "mt-3 flex flex-col gap-3 border-t border-[#E5E7EB] pt-4"
            : "flex flex-col gap-2 pt-2 lg:mt-2"
        }
      >
        <PushNotificationToggle compact />
        <div className="min-w-fit pl-3">
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}
