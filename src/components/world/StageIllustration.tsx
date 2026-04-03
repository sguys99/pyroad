import {
  VillageGateIllust,
  VariableForestIllust,
  ConditionCrossroadIllust,
  LoopCaveIllust,
  ListLakeIllust,
  FunctionTowerIllust,
  ProjectKingdomIllust,
} from './illustrations';

interface StageIllustrationProps {
  themeName: string;
  className?: string;
}

const illustrationMap: Record<string, React.FC<{ className?: string }>> = {
  python_village: VillageGateIllust,
  variable_forest: VariableForestIllust,
  condition_crossroad: ConditionCrossroadIllust,
  loop_cave: LoopCaveIllust,
  list_lake: ListLakeIllust,
  function_tower: FunctionTowerIllust,
  project_kingdom: ProjectKingdomIllust,
};

export function StageIllustration({ themeName, className }: StageIllustrationProps) {
  const Illustration = illustrationMap[themeName];
  if (!Illustration) return null;
  return <Illustration className={className} />;
}
