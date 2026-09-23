import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type DailyUpdateForBackfill = {
  id: string;
  todaysTasks: string;
  completedTasks: string | null;
  tomorrowPlan: string | null;
};

type BackfillPlan = {
  backfilledTodaysTasks: string;
  needsCompletedTasksAppend: boolean;
  needsTomorrowPlanAppend: boolean;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function normalizeForComparison(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

function sectionExists(
  todaysTasks: string,
  heading: "Completed Tasks" | "Tomorrow Plan",
  content: string | null
) {
  const normalizedContent = normalizeForComparison(content);

  if (!normalizedContent) {
    return true;
  }

  const normalizedTodaysTasks = normalizeForComparison(todaysTasks);

  return (
    normalizedTodaysTasks.includes(`${heading}:`) &&
    normalizedTodaysTasks.includes(normalizedContent)
  );
}

function buildBackfillPlan(update: DailyUpdateForBackfill): BackfillPlan {
  const todaysTasks = normalizeText(update.todaysTasks);
  const completedTasks = normalizeText(update.completedTasks);
  const tomorrowPlan = normalizeText(update.tomorrowPlan);
  const needsCompletedTasksAppend =
    Boolean(completedTasks) &&
    !sectionExists(todaysTasks, "Completed Tasks", completedTasks);
  const needsTomorrowPlanAppend =
    Boolean(tomorrowPlan) &&
    !sectionExists(todaysTasks, "Tomorrow Plan", tomorrowPlan);
  const sectionsToAppend: string[] = [];

  if (needsCompletedTasksAppend) {
    sectionsToAppend.push(`Completed Tasks:\n${completedTasks}`);
  }

  if (needsTomorrowPlanAppend) {
    sectionsToAppend.push(`Tomorrow Plan:\n${tomorrowPlan}`);
  }

  return {
    backfilledTodaysTasks:
      sectionsToAppend.length > 0
        ? [todaysTasks, ...sectionsToAppend].filter(Boolean).join("\n\n")
        : todaysTasks,
    needsCompletedTasksAppend,
    needsTomorrowPlanAppend,
  };
}

function logDatabaseTarget() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log("Database target: DATABASE_URL is not set");
    return;
  }

  try {
    const url = new URL(databaseUrl);

    console.log(`Database host: ${url.hostname}`);
    console.log(`Database name: ${url.pathname.replace(/^\//, "")}`);
  } catch {
    const hostMatch = databaseUrl.match(/@([^/:]+)(?::\d+)?\//);
    const databaseMatch = databaseUrl.match(/\/([^/?]+)(?:\?|$)/);

    console.log(`Database host: ${hostMatch?.[1] ?? "unparsed"}`);
    console.log(`Database name: ${databaseMatch?.[1] ?? "unparsed"}`);
  }
}

function logDryRunRecord(update: DailyUpdateForBackfill, plan: BackfillPlan) {
  const reasons = [
    plan.needsCompletedTasksAppend
      ? "completedTasks needs Completed Tasks section"
      : null,
    plan.needsTomorrowPlanAppend
      ? "tomorrowPlan needs Tomorrow Plan section"
      : null,
  ].filter(Boolean);

  if (reasons.length > 0) {
    console.log(`DailyUpdate ${update.id}: ${reasons.join("; ")}`);
  }
}

function logPlan(update: DailyUpdateForBackfill, plan: BackfillPlan) {
  console.log(
    [
      `Before update ${update.id}:`,
      `originalTodaysTasksLength=${normalizeText(update.todaysTasks).length}`,
      `completedTasksLength=${normalizeText(update.completedTasks).length}`,
      `tomorrowPlanLength=${normalizeText(update.tomorrowPlan).length}`,
      `finalBackfilledTodaysTasksLength=${plan.backfilledTodaysTasks.length}`,
      `needsCompletedTasksAppend=${plan.needsCompletedTasksAppend}`,
      `needsTomorrowPlanAppend=${plan.needsTomorrowPlanAppend}`,
    ].join(" ")
  );
}

function verifySections(todaysTasks: string, update: DailyUpdateForBackfill) {
  const completedTasksOk = sectionExists(
    todaysTasks,
    "Completed Tasks",
    update.completedTasks
  );
  const tomorrowPlanOk = sectionExists(
    todaysTasks,
    "Tomorrow Plan",
    update.tomorrowPlan
  );

  return {
    completedTasksOk,
    tomorrowPlanOk,
  };
}

async function fetchTodaysTasks(id: string) {
  const update = await prisma.dailyUpdate.findUnique({
    where: { id },
    select: { todaysTasks: true },
  });

  if (!update) {
    throw new Error(`DailyUpdate ${id} was not found after update.`);
  }

  return update.todaysTasks;
}

async function applyPrismaUpdate(id: string, todaysTasks: string) {
  await prisma.dailyUpdate.update({
    where: { id },
    data: {
      todaysTasks,
    },
  });
}

async function applyRawFallbackUpdate(id: string, todaysTasks: string) {
  await prisma.$executeRaw`
    UPDATE DailyUpdate
    SET workedOn = ${todaysTasks}
    WHERE id = ${id}
  `;
}

async function verifyOrThrow(
  update: DailyUpdateForBackfill,
  plan: BackfillPlan,
  source: "prisma" | "raw fallback"
) {
  const verifiedTodaysTasks = await fetchTodaysTasks(update.id);
  const verification = verifySections(verifiedTodaysTasks, update);

  console.log(
    [
      `After ${source} update ${update.id}:`,
      `todaysTasksLength=${normalizeText(verifiedTodaysTasks).length}`,
      `completedTasksSectionExists=${verification.completedTasksOk}`,
      `tomorrowPlanSectionExists=${verification.tomorrowPlanOk}`,
    ].join(" ")
  );

  const missingSections = [
    plan.needsCompletedTasksAppend && !verification.completedTasksOk
      ? "Completed Tasks"
      : null,
    plan.needsTomorrowPlanAppend && !verification.tomorrowPlanOk
      ? "Tomorrow Plan"
      : null,
  ].filter(Boolean);

  if (missingSections.length > 0) {
    throw new Error(
      `DailyUpdate ${update.id} verification failed. Missing sections after ${source} update: ${missingSections.join(", ")}.`
    );
  }
}

async function applyAndVerify(
  update: DailyUpdateForBackfill,
  plan: BackfillPlan
) {
  await applyPrismaUpdate(update.id, plan.backfilledTodaysTasks);

  try {
    await verifyOrThrow(update, plan, "prisma");
    return;
  } catch (error) {
    console.error(
      `Prisma mapped-field update did not verify for DailyUpdate ${update.id}. Trying raw workedOn fallback.`
    );
    console.error(error);
  }

  await applyRawFallbackUpdate(update.id, plan.backfilledTodaysTasks);
  await verifyOrThrow(update, plan, "raw fallback");
}

async function main() {
  const shouldApply = process.argv.includes("--apply");

  logDatabaseTarget();

  const updates = await prisma.dailyUpdate.findMany({
    select: {
      id: true,
      todaysTasks: true,
      completedTasks: true,
      tomorrowPlan: true,
    },
  });

  let updatedCount = 0;
  let skippedCount = 0;

  for (const update of updates) {
    const plan = buildBackfillPlan(update);
    const needsMigration =
      plan.needsCompletedTasksAppend || plan.needsTomorrowPlanAppend;

    if (!needsMigration) {
      skippedCount += 1;
      continue;
    }

    if (!shouldApply) {
      logDryRunRecord(update, plan);
      updatedCount += 1;
      continue;
    }

    logPlan(update, plan);

    if (plan.backfilledTodaysTasks.length <= normalizeText(update.todaysTasks).length) {
      throw new Error("Backfill build failed: final content did not grow.");
    }

    await applyAndVerify(update, plan);

    updatedCount += 1;
  }

  console.log(
    `Daily update backfill ${shouldApply ? "complete" : "dry run complete"}. Updates ${shouldApply ? "applied" : "needed"}: ${updatedCount}. Skipped: ${skippedCount}.`
  );
}

main()
  .catch((error) => {
    console.error("Daily update backfill failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
