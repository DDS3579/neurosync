import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface ChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
}

// TODO(stub): replaced by Opus output
export function ChartCard({
  title,
  description,
  children,
  footer,
  empty = false,
  emptyMessage = "No data logged for this period yet.",
}: ChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>

      <CardContent>
        {empty ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          children
        )}
      </CardContent>

      {footer ? <CardFooter className="text-xs text-muted-foreground">{footer}</CardFooter> : null}
    </Card>
  );
}
