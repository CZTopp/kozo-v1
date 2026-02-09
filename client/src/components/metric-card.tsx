import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  icon?: LucideIcon;
  className?: string;
}

export function MetricCard({ title, value, subtitle, trend, icon: Icon, className }: MetricCardProps) {
  return (
    <Card className={cn("overflow-visible", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
            <span className="text-2xl font-bold tracking-tight" data-testid={`text-metric-${title.toLowerCase().replace(/\s/g, "-")}`}>{value}</span>
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
            {trend !== undefined && (
              <span className={cn("text-xs font-medium", trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
              </span>
            )}
          </div>
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
