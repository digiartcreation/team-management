type StatCardProps = {
  label: string;
  /** Already-formatted values are allowed, e.g. a "7h 30m" duration. */
  value: number | string;
  description: string;
};

export default function StatCard({ label, value, description }: StatCardProps) {
  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-6 transition duration-200 hover:-translate-y-0.5 hover:border-[#A05DD0]/50 hover:shadow-md">
      <p className="text-sm font-medium text-[#6B7280]">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold tracking-normal text-[#770FC2] sm:mt-3 sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-[#6B7280] sm:mt-2 sm:text-sm">{description}</p>
    </section>
  );
}
