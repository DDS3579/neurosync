export { INSIGHT_CAVEAT, MIN_DAYS_FOR_INSIGHTS, computeInsights } from "./rules";
export {
  EXPERIMENT_CAVEAT,
  MIN_SAMPLES_PER_WINDOW,
  analyzeExperiment,
} from "./experiments";
export { buildWeeklyReport } from "./weekly";
export { generateDemoData } from "./demo";
export type { ExperimentResult, WeeklyReport } from "./types";
