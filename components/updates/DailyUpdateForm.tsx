import FormCard from "@/components/ui/FormCard";
import FormField, { fieldInputClass } from "@/components/ui/FormField";
import TextareaWithBullet from "@/components/ui/TextareaWithBullet";

type DailyUpdateFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  update?: {
    id: string;
    date: Date;
    todaysTasks: string;
    blockers: string | null;
  };
};

function formatDateInput(date?: Date) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default function DailyUpdateForm({
  action,
  submitLabel,
  update,
}: DailyUpdateFormProps) {
  return (
    <FormCard
      action={action}
      title="Daily update"
      description="What you worked on today and anything holding you up. No length limit."
      cancelHref="/updates"
      submitLabel={submitLabel}
    >
      {update ? <input type="hidden" name="id" value={update.id} /> : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField label="Date" htmlFor="update-date" required>
          <input
            id="update-date"
            name="date"
            type="date"
            defaultValue={formatDateInput(update?.date)}
            required
            className={`${fieldInputClass} cursor-pointer`}
          />
        </FormField>
      </div>

      <FormField
        label="Today's tasks"
        htmlFor="update-tasks"
        required
        hint="One line or bullet per task."
      >
        <TextareaWithBullet
          id="update-tasks"
          name="todaysTasks"
          defaultValue={update?.todaysTasks ?? ""}
          placeholder="• Edited the Acme launch video&#10;• Client call about the Q4 posters"
          rows={8}
          required
        />
      </FormField>

      <FormField label="Blockers" htmlFor="update-blockers">
        <TextareaWithBullet
          id="update-blockers"
          name="blockers"
          defaultValue={update?.blockers ?? ""}
          placeholder="Anything stopping you, or help you need."
          rows={4}
        />
      </FormField>
    </FormCard>
  );
}
