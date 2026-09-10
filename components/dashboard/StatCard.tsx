type StatCardProps = {
  label: string;
  /** Already-formatted values are allowed, e.g. a "7h 30m" duration. */
  value: number | string;
  description: string;
};

export default function StatCard({ label, value, description }: StatCardProps) {
  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#A05DD0]/50 hover:shadow-md">
      <p className="text-sm font-medium text-[#6B7280]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-normal text-[#770FC2]">
        {value}
      </p>
      <p className="mt-2 text-sm text-[#6B7280]">{description}</p>
    </section>
  );
}
