import type { ActivityKind, BrainRegionInfo, RegionId } from "@/types/domain";

const EDUCATIONAL_CAVEAT =
  "Educational association only. NeuroSync does not measure brain activity, growth, or health, and no habit here is claimed to strengthen this region.";

export const BRAIN_REGIONS: BrainRegionInfo[] = [
  {
    id: "prefrontal",
    name: "Prefrontal cortex",
    shortDescription:
      "The front of the frontal lobes, commonly involved in planning, working memory, and keeping a goal in mind while other things compete for attention.",
    associatedWith: [
      "planning and prioritising",
      "working memory",
      "inhibitory control",
      "decision making",
    ],
    networks: ["frontoparietal network", "salience network (with the anterior insula)"],
    connectedTo: ["parietal", "temporal", "amygdala"],
    relatedActivities: [
      "deep_focus",
      "problem_solving",
      "active_recall",
      "skill_practice",
      "mindfulness",
      "creative",
    ],
    everydayExamples: [
      "planning a week of study before you start",
      "pausing before replying to a message that annoyed you",
      "holding an instruction in mind while switching tabs",
    ],
    caveat: EDUCATIONAL_CAVEAT,
  },
  {
    id: "parietal",
    name: "Parietal lobe",
    shortDescription:
      "Often described as combining sensory information with attention and spatial reasoning, including where things are and how they relate.",
    associatedWith: [
      "spatial attention",
      "integrating sensory information",
      "mental rotation",
      "number sense",
    ],
    networks: ["dorsal attention network", "frontoparietal network"],
    connectedTo: ["prefrontal", "occipital", "temporal"],
    relatedActivities: ["problem_solving", "reading", "skill_practice", "exercise"],
    everydayExamples: [
      "estimating whether a sofa fits through a doorway",
      "following a route you have only seen once",
      "keeping your place while reading a dense page",
    ],
    caveat: EDUCATIONAL_CAVEAT,
  },
  {
    id: "temporal",
    name: "Temporal lobe",
    shortDescription:
      "Commonly involved in hearing, understanding language, and recognising sounds, objects, and faces. Its inner surface includes the hippocampus.",
    associatedWith: [
      "language comprehension",
      "sound processing",
      "recognising faces and objects",
      "memory for facts",
    ],
    networks: ["default mode network", "auditory and language networks"],
    connectedTo: ["prefrontal", "occipital", "hippocampus", "amygdala"],
    relatedActivities: ["reading", "language_learning", "music", "social", "teaching"],
    everydayExamples: [
      "following a podcast while walking",
      "recognising a friend's voice on a noisy call",
      "picking out a familiar melody",
    ],
    caveat: EDUCATIONAL_CAVEAT,
  },
  {
    id: "occipital",
    name: "Occipital lobe",
    shortDescription:
      "The main visual processing area of the cortex, associated with turning light into edges, shapes, colour, and motion.",
    associatedWith: [
      "visual processing",
      "edge and shape detection",
      "colour and motion perception",
    ],
    networks: ["visual network", "dorsal attention network"],
    connectedTo: ["parietal", "temporal"],
    relatedActivities: ["reading", "creative", "skill_practice"],
    everydayExamples: [
      "reading small print in dim light",
      "spotting movement at the edge of your vision",
      "judging the colour of a photo on a bright screen",
    ],
    caveat: EDUCATIONAL_CAVEAT,
  },
  {
    id: "cerebellum",
    name: "Cerebellum",
    shortDescription:
      "A densely packed structure below the occipital lobe, commonly involved in coordinating movement, balance, and the timing of sequences.",
    associatedWith: [
      "motor coordination",
      "balance",
      "timing and rhythm",
      "automatising practised skills",
    ],
    networks: ["cerebellar motor loops", "cerebro-cerebellar loops"],
    connectedTo: ["prefrontal", "parietal", "occipital"],
    relatedActivities: ["exercise", "skill_practice", "music"],
    everydayExamples: [
      "keeping balance on a moving bus",
      "typing a word sequence without looking",
      "keeping time when clapping along to a song",
    ],
    caveat: EDUCATIONAL_CAVEAT,
  },
  {
    id: "hippocampus",
    name: "Hippocampus",
    shortDescription:
      "A curved structure in the inner temporal lobe, commonly associated with forming new memories, consolidating them, and spatial navigation.",
    associatedWith: [
      "forming new memories",
      "memory consolidation",
      "spatial navigation",
      "context for events",
    ],
    networks: ["default mode network", "medial temporal lobe memory system"],
    connectedTo: ["temporal", "prefrontal", "amygdala"],
    relatedActivities: [
      "active_recall",
      "spaced_repetition",
      "sleep_rest",
      "language_learning",
      "reading",
    ],
    everydayExamples: [
      "remembering where you parked after a long day",
      "recalling a fact you reviewed yesterday",
      "linking a new word to a situation you were in",
    ],
    caveat:
      "Educational association only. Sleep and practice are studied alongside memory consolidation, but NeuroSync measures neither brain activity nor memory, and cannot tell you whether your hippocampus changed.",
  },
  {
    id: "amygdala",
    name: "Amygdala",
    shortDescription:
      "An almond-shaped structure in the temporal lobe, commonly associated with detecting what is emotionally relevant or threatening and tagging it as important.",
    associatedWith: [
      "salience and emotional relevance",
      "threat detection",
      "emotional learning",
      "stress responses",
    ],
    networks: ["salience network", "limbic networks"],
    connectedTo: ["prefrontal", "temporal", "hippocampus"],
    relatedActivities: ["mindfulness", "social", "exercise", "sleep_rest"],
    everydayExamples: [
      "noticing a sudden loud noise before you can name it",
      "feeling alert after a tense conversation",
      "settling after a few slow breaths",
    ],
    caveat:
      "Educational association only. Stress and mood are self-reported here, not measured in the brain, and no activity is claimed to change this region.",
  },
];

export const BRAIN_REGION_BY_ID: Record<RegionId, BrainRegionInfo> = BRAIN_REGIONS.reduce(
  (index, region) => {
    index[region.id] = region;
    return index;
  },
  {} as Record<RegionId, BrainRegionInfo>,
);

export const ACTIVITY_META: Record<ActivityKind, { label: string; description: string }> = {
  deep_focus: {
    label: "Deep focus",
    description: "Sustained attention on one demanding task without switching.",
  },
  active_recall: {
    label: "Active recall",
    description: "Retrieving what you learned from memory instead of re-reading it.",
  },
  spaced_repetition: {
    label: "Spaced repetition",
    description: "Reviewing material again after a delay, in short repeated passes.",
  },
  problem_solving: {
    label: "Problem solving",
    description: "Working through a puzzle, proof, or exercise where the path is not obvious.",
  },
  reading: {
    label: "Reading",
    description: "Reading prose or study material with attention to meaning.",
  },
  skill_practice: {
    label: "Skill practice",
    description: "Deliberately repeating a movement or technique to improve it.",
  },
  teaching: {
    label: "Teaching",
    description: "Explaining something to another person so they can use it.",
  },
  exercise: {
    label: "Exercise",
    description: "Movement that raises your heart rate or loads your muscles.",
  },
  mindfulness: {
    label: "Mindfulness",
    description: "Paying attention to the present moment, often with slow breathing.",
  },
  social: {
    label: "Social time",
    description: "Time spent talking or being with other people.",
  },
  creative: {
    label: "Creative work",
    description: "Making something new: writing, drawing, designing, building.",
  },
  music: {
    label: "Music",
    description: "Playing, singing, or listening closely to music.",
  },
  language_learning: {
    label: "Language learning",
    description: "Studying vocabulary, grammar, or conversation in another language.",
  },
  sleep_rest: {
    label: "Sleep and rest",
    description: "Night sleep, naps, or deliberate rest.",
  },
};

/**
 * Educational associations used to colour the activity view. Weights are a
 * rough illustration of which regions are often discussed together with an
 * activity; they are not measurements.
 */
export const ACTIVITY_REGION_MAP: Record<ActivityKind, { region: RegionId; weight: number }[]> = {
  deep_focus: [
    { region: "prefrontal", weight: 0.9 },
    { region: "parietal", weight: 0.55 },
  ],
  active_recall: [
    { region: "hippocampus", weight: 0.8 },
    { region: "prefrontal", weight: 0.7 },
  ],
  spaced_repetition: [
    { region: "hippocampus", weight: 0.75 },
    { region: "parietal", weight: 0.4 },
  ],
  problem_solving: [
    { region: "prefrontal", weight: 0.9 },
    { region: "parietal", weight: 0.7 },
  ],
  reading: [
    { region: "occipital", weight: 0.8 },
    { region: "temporal", weight: 0.7 },
  ],
  skill_practice: [
    { region: "cerebellum", weight: 0.8 },
    { region: "prefrontal", weight: 0.5 },
  ],
  teaching: [
    { region: "temporal", weight: 0.7 },
    { region: "prefrontal", weight: 0.7 },
  ],
  exercise: [
    { region: "cerebellum", weight: 0.8 },
    { region: "parietal", weight: 0.4 },
  ],
  mindfulness: [
    { region: "prefrontal", weight: 0.7 },
    { region: "amygdala", weight: 0.55 },
  ],
  social: [
    { region: "temporal", weight: 0.6 },
    { region: "amygdala", weight: 0.5 },
  ],
  creative: [
    { region: "prefrontal", weight: 0.7 },
    { region: "temporal", weight: 0.5 },
  ],
  music: [
    { region: "temporal", weight: 0.8 },
    { region: "cerebellum", weight: 0.6 },
  ],
  language_learning: [
    { region: "temporal", weight: 0.8 },
    { region: "prefrontal", weight: 0.6 },
  ],
  sleep_rest: [
    { region: "hippocampus", weight: 0.8 },
    { region: "prefrontal", weight: 0.4 },
  ],
};

/**
 * Turns minutes per activity into a 0..1 intensity per region, normalised so
 * the strongest region is 1. Pure and deterministic; used only to drive the
 * educational activity view.
 */
export function activityToRegionIntensity(
  items: { kind: ActivityKind; minutes: number }[],
): Partial<Record<RegionId, number>> {
  const totals: Partial<Record<RegionId, number>> = {};

  for (const item of items) {
    if (!Number.isFinite(item.minutes) || item.minutes <= 0) continue;

    for (const { region, weight } of ACTIVITY_REGION_MAP[item.kind] ?? []) {
      totals[region] = (totals[region] ?? 0) + item.minutes * weight;
    }
  }

  const values = Object.values(totals).filter(
    (value): value is number => typeof value === "number",
  );
  const max = Math.max(0, ...values);

  if (max <= 0) return {};

  const intensities: Partial<Record<RegionId, number>> = {};

  for (const [region, total] of Object.entries(totals)) {
    if (typeof total !== "number") continue;
    intensities[region as RegionId] = Math.min(1, total / max);
  }

  return intensities;
}
