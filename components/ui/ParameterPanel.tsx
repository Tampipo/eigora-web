export function ParameterPanel({
  title = "Parameters",
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-lg border border-border bg-surface/40 p-4 " +
        (className ?? "")
      }
    >
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
        {title}
      </p>
      <div className="space-y-3.5">{children}</div>
    </div>
  );
}
