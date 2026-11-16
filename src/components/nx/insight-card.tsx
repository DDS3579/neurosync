import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegionBadge } from "@/components/nx/region-badge";
import type { Insight, Pillar } from "@/types/domain";

export interface InsightCardProps {
  insight: Insight;
}

const PILLAR_LABEL: Record<Pillar, string> = {
  sleep: "Sleep",
  focus: "Focus",
  movement: "Movement",
  nutrition: "Nutrition",
  wellbeing: "Wellbeing",
  learning: "Learning",
};

// TODO(stub): replaced by Opus output
export function InsightCard({ insight }: InsightCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{PILLAR_LABEL[insight.pillar]}</Badge>
          <span className="text-xs text-muted-foreground">{insight.kind}</span>
        </div>
        <CardTitle>{insight.title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{insight.body}</p>

        {insight.evidence.length > 0 ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {insight.evidence.map((item) => (
              <li key={item} className="tabular-nums">
                {item}
              </li>
            ))}
          </ul>
        ) : null}

        {insight.education ? (
          <p className="text-xs text-foreground/80">{insight.education}</p>
        ) : null}

        {insight.regions && insight.regions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {insight.regions.map((region) => (
              <RegionBadge key={region} region={region} />
            ))}
          </div>
        ) : null}

        <p className="border-t border-border pt-3 text-xs text-muted-foreground">{insight.caveat}</p>
      </CardContent>
    </Card>
  );
}
