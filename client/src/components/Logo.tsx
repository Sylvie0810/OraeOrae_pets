export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full bg-brand text-white shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden
    >
      🐾
    </div>
  );
}

export function BrandMark({ tagline = false }: { tagline?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Logo size={64} />
      <div className="font-display text-2xl font-bold tracking-tight text-ink">OraeOrae</div>
      {tagline && (
        <p className="text-center text-sm leading-relaxed text-ink-soft">
          사랑하는 반려동물,<br />건강하게 오래오래
        </p>
      )}
    </div>
  );
}
