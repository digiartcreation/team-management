import FormCard from "@/components/ui/FormCard";
import FormField, { fieldInputClass } from "@/components/ui/FormField";
import TextareaWithBullet from "@/components/ui/TextareaWithBullet";

type ToolUsageFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  entry?: {
    id: string;
    toolName: string;
    category: string;
    purpose: string;
    timeSpent: string;
    outcome: string | null;
    date: Date;
  };
};

const categories = ["AI Assistant", "Automation", "Research", "Design", "Development", "Other"];

function formatDateInput(date?: Date) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default function ToolUsageForm({ action, submitLabel, entry }: ToolUsageFormProps) {
  return (
    <FormCard
      action={action}
      title="Tool usage"
      description="Which tool you used, what for, and what came of it. No length limit on any field."
      cancelHref="/tools"
      submitLabel={submitLabel}
    >
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField label="Tool name" htmlFor="tool-name" required>
          <input
            id="tool-name"
            name="toolName"
            defaultValue={entry?.toolName}
            required
            placeholder="Eg: ChatGPT, Midjourney, Zapier"
            className={fieldInputClass}
          />
        </FormField>

        <FormField label="Category" htmlFor="tool-category" required>
          <select
            id="tool-category"
            name="category"
            defaultValue={entry?.category ?? "AI Assistant"}
            required
            className={fieldInputClass}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Date" htmlFor="tool-date" required>
          <input
            id="tool-date"
            name="date"
            type="date"
            defaultValue={formatDateInput(entry?.date)}
            required
            className={`${fieldInputClass} cursor-pointer`}
          />
        </FormField>

        <FormField label="Time spent" htmlFor="tool-time" required>
          <input
            id="tool-time"
            name="timeSpent"
            defaultValue={entry?.timeSpent}
            required
            placeholder="Eg: 1 hour 30 minutes"
            className={fieldInputClass}
          />
        </FormField>
      </div>

      <FormField label="Purpose" htmlFor="tool-purpose" required>
        <TextareaWithBullet
          id="tool-purpose"
          name="purpose"
          defaultValue={entry?.purpose ?? ""}
          placeholder="What did you use it for?"
          rows={5}
          required
        />
      </FormField>

      <FormField label="Outcome" htmlFor="tool-outcome">
        <TextareaWithBullet
          id="tool-outcome"
          name="outcome"
          defaultValue={entry?.outcome ?? ""}
          placeholder="What came out of it? Did it save time or improve the work?"
          rows={5}
        />
      </FormField>
    </FormCard>
  );
}
