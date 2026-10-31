import FormCard from "@/components/ui/FormCard";
import FormField, { fieldInputClass } from "@/components/ui/FormField";
import TextareaWithBullet from "@/components/ui/TextareaWithBullet";

type LearningFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  learning?: {
    id: string;
    title: string;
    description: string;
    category: string;
    referenceLink: string | null;
  };
};

const categories = [
  "Development",
  "Design",
  "Marketing",
  "Research",
  "AI Tools",
  "Other",
];

export default function LearningForm({
  action,
  submitLabel,
  learning,
}: LearningFormProps) {
  return (
    <FormCard
      action={action}
      title="Learning details"
      description="What you learned, and where to find it again. No length limit on any field."
      cancelHref="/learnings"
      submitLabel={submitLabel}
    >
      {learning ? <input type="hidden" name="id" value={learning.id} /> : null}

      <FormField label="Title" htmlFor="learning-title" required>
        <input
          id="learning-title"
          name="title"
          defaultValue={learning?.title}
          required
          placeholder="Eg: Building dashboard layouts with CSS grid"
          className={fieldInputClass}
        />
      </FormField>

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField label="Category" htmlFor="learning-category" required>
          <select
            id="learning-category"
            name="category"
            defaultValue={learning?.category ?? "Development"}
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

        <FormField
          label="Reference link"
          htmlFor="learning-link"
          hint="A course, article or video to go back to."
        >
          <input
            id="learning-link"
            name="referenceLink"
            type="url"
            defaultValue={learning?.referenceLink ?? ""}
            placeholder="https://"
            className={fieldInputClass}
          />
        </FormField>
      </div>

      <FormField label="Description" htmlFor="learning-description" required>
        <TextareaWithBullet
          id="learning-description"
          name="description"
          defaultValue={learning?.description ?? ""}
          placeholder="What did you learn, and how will you use it in your work?"
          rows={8}
          required
        />
      </FormField>
    </FormCard>
  );
}
