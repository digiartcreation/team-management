// Activity logging is switched off: nothing is written to the Activity log,
// and the Activity page and menu item are commented out too. The callers
// (every actions.ts, lib/autoCheckOut.ts) still call logActivity, which now
// does nothing. To switch it back on, restore the commented code below and
// the Activity menu items (components/layout/Sidebar.tsx), the page
// (app/activity/page.tsx) and the Activity search (app/search/page.tsx).
//
// import { after } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { fitText } from "@/lib/fitText";

type ActivityInput = {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
};

/** Switched off: records nothing (see the note at the top of this file). */
export async function logActivity(input: ActivityInput) {
  void input;
}

// /**
//  * Records an entry in the Activity log. The row is written after the response
//  * has gone out (next/server `after`), so a save does not wait on a log write
//  * it never shows; it lands moments later, in the same request. Outside a
//  * request, where `after` is not available, it is written straight away.
//  */
// export async function logActivity({
//   userId,
//   action,
//   entityType,
//   entityId,
//   description,
// }: ActivityInput) {
//   const write = () =>
//     prisma.activityLog.create({
//       data: {
//         userId,
//         action,
//         entityType,
//         entityId,
//         // Quotes titles that can run to any length; the column holds 191.
//         description: fitText(description),
//       },
//     });
//
//   try {
//     after(async () => {
//       try {
//         await write();
//       } catch (error) {
//         console.error("Could not record activity:", error);
//       }
//     });
//   } catch {
//     await write();
//   }
// }
