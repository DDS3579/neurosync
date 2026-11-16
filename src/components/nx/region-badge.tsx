import { Badge } from "@/components/ui/badge";
import { BRAIN_REGION_BY_ID } from "@/data/brainRegions";
import type { RegionId } from "@/types/domain";

export interface RegionBadgeProps {
  region: RegionId;
}

// TODO(stub): replaced by Opus output
export function RegionBadge({ region }: RegionBadgeProps) {
  const info = BRAIN_REGION_BY_ID[region];

  return (
    <Badge variant="outline" className="border-violet/30 bg-violet/10 text-violet">
      {info?.name ?? region}
    </Badge>
  );
}
