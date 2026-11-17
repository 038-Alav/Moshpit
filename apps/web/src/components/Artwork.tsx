import { Icon } from "./Icon";

export function Artwork({ seed = 0, size = "medium", label, className = "" }: { seed?: number; size?: "small" | "medium" | "large" | "hero"; label?: string; className?: string }) {
  const variants = ["art-violet", "art-blue", "art-orange", "art-green", "art-pink", "art-ink"];
  const variant = variants[Math.abs(seed) % variants.length];
  return (
    <div className={`artwork ${variant} artwork-${size} ${className}`} aria-label={label ?? "Carátula de música"} role="img">
      <span className="artwork-orbit artwork-orbit-one" />
      <span className="artwork-orbit artwork-orbit-two" />
      <span className="artwork-center"><Icon name="disc" size={size === "small" ? 19 : size === "hero" ? 62 : 30} strokeWidth={1.2} /></span>
      <span className="artwork-grain" />
    </div>
  );
}
