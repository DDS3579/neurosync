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

export type ReminderKind = 'windDown' | 'checkin' | 'reviewDue';

export interface ReminderSlotConfig {
  enabled: boolean;
  time: string; // 'HH:MM' 24-hour local time
}

export interface QuietHoursConfig {
  enabled: boolean;
  start: string; // 'HH:MM' 24-hour local time
  end: string;   // 'HH:MM' 24-hour local time
}

export interface ReminderSettings {
  windDown: ReminderSlotConfig;
  checkin: ReminderSlotConfig;
  reviewDue: ReminderSlotConfig;
  quietHours: QuietHoursConfig;
}

export type TextSizePref = 'sm' | 'md' | 'lg';

export interface UserSettings extends Base {
  displayName?: string; sleepTargetMin: number;      // default 480
  focusDefaultMin: number;                            // default 25
  breakDefaultMin: number;                            // default 5
  onboarded: boolean; reducedMotion?: boolean;
  highContrast?: boolean; textSize?: TextSizePref;
  reminders?: ReminderSettings;
  schemaVersion: number;
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

export type PlanBlockKind =
  | 'fixed'
  | 'study'
  | 'break'
  | 'movement'
  | 'recovery'
  | 'wind_down'
  | 'sleep';

export interface PlannerFixedCommitment {
  id: string;
  title: string;
  startTime: string; // 'HH:MM'
  endTime: string;   // 'HH:MM'
}

export interface PlannerStudyGoal {
  id: string;
  subject: string;
  minutes: number;
  difficulty?: Rating;
}

export interface ScheduledPlanBlock {
  id: string;
  kind: PlanBlockKind;
  title: string;
  startTime: string; // 'HH:MM'
  endTime: string;   // 'HH:MM'
  durationMin: number;
  subject?: string;
  difficulty?: Rating;
  notes?: string;
}

export interface UnscheduledGoalItem {
  id: string;
  title: string;
  kind: 'study' | 'movement' | 'fixed';
  minutes: number;
  reason: string;
}

export interface DayPlan extends Base {
  date: ISODate;
  wakeTime: string; // 'HH:MM'
  sleepTargetMin: number;
  windDownMin: number;
  maxStudyBlockMin: number;
  breakMin: number;
  bufferMin: number;
  movementGoalMin: number;
  preferRecoverySpacing: boolean;
  commitments: PlannerFixedCommitment[];
  studyGoals: PlannerStudyGoal[];
  blocks: ScheduledPlanBlock[];
  unscheduled: UnscheduledGoalItem[];
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
export type DataConfidenceLevel = 'low' | 'moderate' | 'enough';

export interface InsightConfidence {
  level: DataConfidenceLevel;
  /** One-line plain explanation, e.g. "Based on 9 days of paired data". */
  summary: string;
  sampleSize: number;
}

export interface Insight {
  id: string; pillar: Pillar; kind: 'observation' | 'milestone' | 'reflection';
  title: string; body: string; evidence: string[];  // human-readable data points
  caveat: string; education?: string; regions?: RegionId[]; // educational associations only
  confidence?: InsightConfidence;
}

export type InsightFeedbackStatus = 'dismissed' | 'snoozed';

export interface InsightFeedback extends Base {
  insightId: string;
  status: InsightFeedbackStatus;
  /** Exclusive 'YYYY-MM-DD' date when snooze ends (fires again when today >= snoozeUntil). */
  snoozeUntil?: ISODate;
  title?: string;
  pillar?: Pillar;
}
export interface BrainRegionInfo {
  id: RegionId; name: string; shortDescription: string; associatedWith: string[];
  networks: string[]; connectedTo: RegionId[]; relatedActivities: ActivityKind[];
  everydayExamples: string[]; caveat: string;
}
