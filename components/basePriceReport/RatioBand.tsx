import { RATIO_BANDS, ratioBand, roundRatio, scalePosition } from "@/lib/basePriceReport";

/** The band a ratio falls in: a colour key and its name, never colour alone. */
export function BandChip({ ratio }: { ratio: number }) {
  const band = ratioBand(ratio);

  return (
    <span
      title={`${band.label} · ${band.range}`}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700"
    >
      <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: band.color }} />
      {band.colorName}
    </span>
  );
}

/** "1.52" beside its band. */
export function RatioValue({ ratio }: { ratio: number }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="font-semibold text-slate-950 tabular-nums">{roundRatio(ratio).toFixed(2)}</span>
      <BandChip ratio={ratio} />
    </span>
  );
}

/** The five bands as one bar, with the ratio marked where it falls. */
export function RatioScale({
  ratio,
  showRanges = false,
  tone = "light",
}: {
  ratio: number;
  showRanges?: boolean;
  tone?: "light" | "dark";
}) {
  const position = scalePosition(ratio);
  // Keeps the value label inside the bar's ends.
  const labelPosition = Math.min(94, Math.max(6, position));

  return (
    <div className="w-full">
      <div className="relative h-5">
        <span
          className={`absolute top-0 -translate-x-1/2 rounded px-1.5 py-px text-[10px] font-semibold tabular-nums ${
            tone === "dark" ? "bg-white text-slate-950" : "bg-slate-900 text-white"
          }`}
          style={{ left: `${labelPosition}%` }}
        >
          {roundRatio(ratio).toFixed(2)}
        </span>
      </div>
      <div className="relative">
        <div className="flex gap-0.5" role="img" aria-label={`Ratio ${roundRatio(ratio).toFixed(2)}, ${ratioBand(ratio).colorName}`}>
          {RATIO_BANDS.map((band) => (
            <span
              key={band.colorName}
              className="h-2 flex-1 first:rounded-l-full last:rounded-r-full"
              style={{ background: band.color }}
            />
          ))}
        </div>
        <span
          aria-hidden
          className={`absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full ${
            tone === "dark" ? "bg-white" : "bg-slate-900"
          }`}
          style={{ left: `${position}%` }}
        />
      </div>
      {showRanges ? (
        <div className="mt-1.5 grid grid-cols-5 gap-0.5 text-[10px] leading-tight text-slate-500">
          {RATIO_BANDS.map((band) => (
            <span key={band.colorName}>
              <span className="block font-medium text-slate-700">{band.colorName}</span>
              {band.range}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
