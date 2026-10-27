"use client";

import PeoplePicker from "@/components/ui/PeoplePicker";

type WatchersFieldProps = {
  people: { id: string; name: string }[];
  /** Watchers already on the task; empty when adding one. */
  selectedIds: string[];
};

/**
 * Who else follows the task. Watchers see it in the Watching section of their
 * dashboard and can log time on it; the status stays with the assignee. Picked
 * from everyone, not just the assignee's team -- pulling in help from another
 * team is the point.
 */
export default function WatchersField({ people, selectedIds }: WatchersFieldProps) {
  return (
    <PeoplePicker
      people={people}
      selectedIds={selectedIds}
      name="watcherIds"
      legend="Watchers"
      hint="Watchers see this task on their dashboard and can log time on it. The assigned employee does not need adding."
      groupLabel="watchers"
    />
  );
}
