import TaskBoard from "@/components/dashboard/TaskBoard";
import type { BoardColumn } from "@/lib/taskBoard";

type WatchingBoardProps = {
  /** From loadWatchedBoard (lib/taskBoard.ts). */
  columns: BoardColumn[];
  /** Today as "YYYY-MM-DD", for the log time dialog. */
  today: string;
};

/**
 * The tasks someone was added to as a watcher, laid out like their own board.
 * Left off the dashboard entirely while they watch nothing.
 */
export default function WatchingBoard({ columns, today }: WatchingBoardProps) {
  if (!columns.some((column) => column.total > 0)) {
    return null;
  }

  return (
    <TaskBoard
      heading="Watching"
      description="Tasks you were added to as a watcher. Log the time you spend on them here, and close them once completed; the assignee moves the rest."
      columns={columns}
      today={today}
      watching
    />
  );
}
