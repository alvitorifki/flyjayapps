import { cn } from "@/lib/utils";

type Status = "valid" | "warning" | "expired" | "active" | "fit" | string;

const map: Record<string, string> = {
  valid: "bg-success-soft text-[hsl(var(--success))]",
  fit: "bg-success-soft text-[hsl(var(--success))]",
  active: "bg-success-soft text-[hsl(var(--success))]",
  warning: "bg-warning-soft text-[hsl(var(--warning))]",
  expired: "bg-destructive-soft text-destructive",
  unfit: "bg-destructive-soft text-destructive",
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const s = (status || "").toLowerCase();
  const cls = map[s] || "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide",
        cls,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
