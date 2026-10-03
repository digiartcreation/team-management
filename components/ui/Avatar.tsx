/**
 * Avatar tints, picked by name rather than at random so the same person keeps
 * the same colour from one render to the next.
 */
const AVATAR_TINTS = [
  "bg-[#770FC2]",
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-indigo-500",
];

function tintFor(name: string) {
  let sum = 0;

  for (let index = 0; index < name.length; index += 1) {
    sum += name.charCodeAt(index);
  }

  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
}

/** "Mubarak Ali" -> "MA", "Yaseen" -> "YA". */
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  const letters =
    parts.length === 1
      ? parts[0].slice(0, 2)
      : `${parts[0][0]}${parts[parts.length - 1][0]}`;

  return letters.toUpperCase();
}

export default function Avatar({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span
        title="Unassigned"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] font-semibold text-slate-400"
      >
        --
      </span>
    );
  }

  return (
    <span
      title={name}
      className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ${tintFor(name)}`}
    >
      {initialsOf(name)}
    </span>
  );
}
