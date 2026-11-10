import { LOGO_GRADIENT, LOGO_MARK_PATH, LOGO_VIEWBOX } from "@/lib/digiartLogo";

/**
 * The Digiart Creation logo, drawn into the page from code (lib/digiartLogo.ts).
 * `className` sets its size and corners.
 *
 * The purple background is the box's CSS gradient rather than an SVG one: an
 * SVG gradient needs an id, and every page has two logos (the sidebar's and the
 * phone bar's, one of them hidden), which would share it.
 */
export default function DigiartLogo({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Digiart Creation logo"
      className={`block overflow-hidden ${className}`}
      style={{
        backgroundImage: `linear-gradient(to right, ${LOGO_GRADIENT.from}, ${LOGO_GRADIENT.to})`,
      }}
    >
      <svg viewBox={LOGO_VIEWBOX} aria-hidden="true" className="block h-full w-full">
        <path fill="#fff" fillRule="evenodd" d={LOGO_MARK_PATH} />
      </svg>
    </span>
  );
}
