export type ISODate = string;      // 'YYYY-MM-DD'
export type ISODateTime = string;  // ISO 8601
export type Rating = 1 | 2 | 3 | 4 | 5;

export type RegionId = 'prefrontal' | 'parietal' | 'temporal' | 'occipital'
  | 'cerebellum' | 'hippocampus' | 'amygdala';

export type ActivityKind = 'deep_focus' | 'active_recall' | 'spaced_repetition' | 'problem_solving'
  | 'reading' | 'skill_practice' | 'teaching' | 'exercise' | 'mindfulness' | 'social'
  | 'creative' | 'music' | 'language_learning' | 'puzzles_games' | 'new_hobby' | 'novelty'
  | 'sleep_rest';

export type LearningMethod = 'active_recall' | 'spaced_repetition' | 'problem_solving'
  | 'deep_reading' | 'skill_practice' | 'teaching';

export interface Base { id: string; createdAt: ISODateTime; updatedAt: ISODateTime; }

export interface UserSettings extends Base {
  displayName?: string; sleepTargetMin: number;      // default 480
  focusDefaultMin: number;                            // default 25
  breakDefaultMin: number;                            // default 5
  onboarded: boolean; reducedMotion?: boolean; schemaVersion: number;
}
export interface SleepLog extends Base {
  date: ISODate;            // the WAKE-UP date
  bedtime: ISODateTime; wakeTime: ISODateTime; durationMin: number;
  quality: Rating; rested: Rating; interruptions: number;
}
export interface DailyCheckin extends Base {
  date: ISODate; mood: Rating; stress: Rating; energy: Rating;
  concentration: Rating; motivation: Rating; outdoorMin?: number; note?: string;
}
export interface FocusSession extends Base {
  date: ISODate; startedAt: ISODateTime; durationMin: number; plannedMin: number;
  subject: string; method: LearningMethod; focusRating: Rating; difficulty: Rating;
  distractions: number; notes?: string;
  practicedRetrieval?: boolean;
  reviewedPrior?: boolean;
}
export interface MovementLog extends Base {
  date: ISODate; type: 'walk'|'run'|'cycle'|'sport'|'gym'|'stretch'|'other';
  durationMin: number; effort: Rating;
}
export interface NutritionLog extends Base {
  date: ISODate; regularMeals: boolean; fruitVeg: boolean; varied: boolean;
  waterGlasses: number; note?: string;
}
export interface Habit extends Base { name: string; icon?: string; archived: boolean; }
export interface HabitLog extends Base { date: ISODate; habitId: string; done: boolean; }

export type MindfulnessType = 'box_breathing' | '4_7_8_breathing' | 'meditation';
export interface MindfulnessSession extends Base {
  date: ISODate;
  type: MindfulnessType;
  durationMin: number;
}
export interface JournalEntry extends Base {
  date: ISODate;
  text: string;
}
export interface GratitudeEntry extends Base {
  date: ISODate;
  items: string[];
}

export type PersonalActivityType =
  | 'social'
  | 'creative'
  | 'music'
  | 'language_learning'
  | 'puzzles_games'
  | 'new_hobby'
  | 'novelty';

export interface ActivityLog extends Base {
  date: ISODate;
  type: PersonalActivityType;
  durationMin: number;
  enjoyment: Rating;
  note?: string;
}

export type ReviewDifficulty = 'easy' | 'okay' | 'hard';

export interface ReviewItem extends Base {
  topic: string;
  intervalStep: number;
  nextReviewDate: ISODate;
  lastReviewedDate?: ISODate;
  reviewCount: number;
  notes?: string;
}

export type ExperimentMetric = 'concentration' | 'mood' | 'energy' | 'stress' | 'focusRating';
export interface Experiment extends Base {
  title: string; hypothesis: string; changeDescription: string; metric: ExperimentMetric;
  baselineStart: ISODate; baselineEnd: ISODate; interventionStart: ISODate; interventionEnd: ISODate;
  status: 'planned' | 'baseline' | 'intervention' | 'complete'; reflection?: string;
}

export interface InsightInput {
  settings: UserSettings; sleep: SleepLog[]; checkins: DailyCheckin[]; focus: FocusSession[];
  movement: MovementLog[]; nutrition: NutritionLog[]; habits: Habit[]; habitLogs: HabitLog[];
  activities?: ActivityLog[]; mindfulness?: MindfulnessSession[];
  journal?: JournalEntry[]; gratitude?: GratitudeEntry[];
}
export type Pillar = 'sleep'|'focus'|'movement'|'nutrition'|'wellbeing'|'learning';
export interface Insight {
  id: string; pillar: Pillar; kind: 'observation' | 'milestone' | 'reflection';
  title: string; body: string; evidence: string[];  // human-readable data points
  caveat: string; education?: string; regions?: RegionId[]; // educational associations only
}
export interface BrainRegionInfo {
  id: RegionId; name: string; shortDescription: string; associatedWith: string[];
  networks: string[]; connectedTo: RegionId[]; relatedActivities: ActivityKind[];
  everydayExamples: string[]; caveat: string;
}
