import type { ActivityKind, BrainRegionInfo, RegionId } from '@/types/domain';

/**
 * Static educational content. These are simplified, hedged associations for learning —
 * not measurements, not diagnostics, and never claims that habits change brain structure.
 */
export const BRAIN_REGIONS: BrainRegionInfo[] = [
  {
    id: 'prefrontal',
    name: 'Prefrontal Cortex',
    shortDescription:
      'The front part of the frontal lobes, sitting just behind your forehead. It is commonly associated with planning, decision-making, holding information in mind, and steering attention toward what matters.',
    associatedWith: [
      'Planning and goal-setting',
      'Working memory (holding information in mind)',
      'Decision-making and weighing options',
      'Directing attention and resisting distractions',
      'Regulating emotions and impulses',
      'Switching flexibly between tasks',
    ],
    networks: [
      'Frontoparietal control network',
      'Default mode network (medial prefrontal areas)',
      'Cingulo-opercular network',
    ],
    connectedTo: ['parietal', 'temporal', 'hippocampus', 'amygdala', 'cerebellum'],
    relatedActivities: ['deep_focus', 'problem_solving', 'active_recall', 'mindfulness', 'teaching', 'puzzles_games', 'novelty'],
    everydayExamples: [
      'Deciding what to work on first when everything feels urgent',
      'Holding a phone number in mind while you look for a pen',
      'Noticing the urge to check your phone and choosing to keep reading',
    ],
    caveat:
      'These are simplified educational associations, not measurements. The prefrontal cortex works in networks with the rest of the brain, and no single region explains planning or focus on its own.',
  },
  {
    id: 'parietal',
    name: 'Parietal Lobe',
    shortDescription:
      'A broad region at the top and back of the cortex, behind the frontal lobe. It is commonly associated with combining touch and body-position signals, mapping space, and pointing attention at places and objects.',
    associatedWith: [
      'Sense of touch and body position',
      'Spatial awareness and mental maps',
      'Directing attention to places and objects',
      'Number sense and mental arithmetic',
      'Combining information from different senses',
    ],
    networks: [
      'Dorsal attention network',
      'Frontoparietal control network',
      'Default mode network (posterior areas)',
    ],
    connectedTo: ['prefrontal', 'occipital', 'temporal'],
    relatedActivities: ['problem_solving', 'deep_focus', 'skill_practice', 'music', 'puzzles_games'],
    everydayExamples: [
      'Reaching for a mug without looking at it',
      'Judging whether a book will fit on a shelf',
      'Tracking a ball across a field',
    ],
    caveat:
      'A simplified educational overview. Spatial attention and touch emerge from networks spanning several lobes, and this app cannot measure activity in any of them.',
  },
  {
    id: 'temporal',
    name: 'Temporal Lobe',
    shortDescription:
      'The cortex along the sides of the brain, roughly behind your ears. It is commonly associated with hearing, understanding language, and recognizing faces and objects; its inner (medial) parts are closely tied to memory.',
    associatedWith: [
      'Hearing and processing speech sounds',
      'Understanding language',
      'Recognizing faces and objects',
      'Memory for facts and events (medial temporal areas)',
      'Processing music and voices',
    ],
    networks: [
      'Auditory and language networks',
      "Ventral visual ('what') pathway",
      'Medial temporal memory system',
    ],
    connectedTo: ['prefrontal', 'parietal', 'occipital', 'hippocampus', 'amygdala'],
    relatedActivities: ['reading', 'language_learning', 'music', 'social', 'active_recall'],
    everydayExamples: [
      "Recognizing a friend's voice on a call",
      'Following the lyrics of a song',
      'Picking out a familiar face in a crowd',
    ],
    caveat:
      'Simplified associations for learning, not measurement. Hearing, language and memory depend on networks across and beyond the temporal lobe.',
  },
  {
    id: 'occipital',
    name: 'Occipital Lobe',
    shortDescription:
      'The lobe at the very back of the brain, and the main hub for visual processing. It is commonly associated with analyzing the basic features of a scene — edges, color and motion — before other areas take over.',
    associatedWith: [
      'Processing edges, shapes and contrast',
      'Perceiving color',
      'Detecting visual motion',
      'Early stages of reading (letter shapes)',
      "Feeding the 'what' and 'where/how' visual pathways",
    ],
    networks: [
      'Visual network',
      "Ventral visual ('what') pathway",
      "Dorsal visual ('where/how') pathway",
    ],
    connectedTo: ['parietal', 'temporal'],
    relatedActivities: ['reading', 'creative', 'skill_practice'],
    everydayExamples: [
      'Reading text on a page or screen',
      'Spotting a friend across a busy street',
      'Watching where a ball is heading',
    ],
    caveat:
      'A simplified educational sketch. Vision is built by networks that run from the occipital lobe into the parietal and temporal lobes; seeing is not a one-region job.',
  },
  {
    id: 'cerebellum',
    name: 'Cerebellum',
    shortDescription:
      "The 'little brain' tucked underneath the back of the cortex. It is best known for coordinating movement, balance and practiced skills, and research also links it to loops involved in attention and thought.",
    associatedWith: [
      'Coordinating smooth, accurate movement',
      'Balance and posture',
      'Motor learning (practiced movements becoming automatic)',
      'Timing and prediction',
      'Possible supporting roles in attention and language (still being researched)',
    ],
    networks: ['Sensorimotor network', 'Cerebro-cerebellar loops with the cortex'],
    connectedTo: ['prefrontal', 'parietal'],
    relatedActivities: ['exercise', 'skill_practice', 'music', 'new_hobby'],
    everydayExamples: [
      'Riding a bike without thinking about balance',
      'Typing without looking at the keys',
      'Staying steady on an uneven sidewalk',
    ],
    caveat:
      'Simplified educational associations. The cerebellum works in loops and networks with the cortex, and its possible roles in thinking are still being researched.',
  },
  {
    id: 'hippocampus',
    name: 'Hippocampus',
    shortDescription:
      'A seahorse-shaped structure buried deep inside each temporal lobe — an internal structure, not part of the visible surface. It is commonly associated with forming new memories of events and facts, and with spatial navigation.',
    associatedWith: [
      'Forming new memories of events and facts',
      'Spatial navigation and mental maps',
      'Linking the parts of an experience into one memory',
      'Consolidating memories during rest and sleep (with the cortex)',
      'Context for memories (where and when)',
    ],
    networks: [
      'Hippocampal memory system (medial temporal lobe)',
      'Default mode network (memory interactions)',
    ],
    connectedTo: ['temporal', 'prefrontal', 'amygdala'],
    relatedActivities: ['sleep_rest', 'active_recall', 'spaced_repetition', 'reading', 'language_learning', 'novelty'],
    everydayExamples: [
      'Remembering what you did last weekend',
      'Finding your way around a new neighborhood',
      'Recalling a fact you studied yesterday',
    ],
    caveat:
      'A simplified educational overview, not a measurement. Memory depends on networks linking the hippocampus with the cortex, and logging habits here tells us nothing about your hippocampus.',
  },
  {
    id: 'amygdala',
    name: 'Amygdala',
    shortDescription:
      'An almond-shaped cluster of nuclei deep inside each temporal lobe, next to the hippocampus. It is commonly associated with flagging emotionally significant events — both threatening and rewarding — and with emotional learning.',
    associatedWith: [
      'Flagging what matters emotionally (salience)',
      'Learning what predicts threat or reward',
      'Emotional reactions, including but not limited to fear',
      'Tagging emotional events so they are often remembered more vividly',
      'Pairing sights and sounds with emotional meaning',
    ],
    networks: [
      'Salience network (interactions)',
      'Medial temporal memory network',
      'Emotion-regulation circuits with the prefrontal cortex',
    ],
    connectedTo: ['hippocampus', 'prefrontal', 'temporal'],
    relatedActivities: ['mindfulness', 'social', 'music'],
    everydayExamples: [
      'Jumping at a sudden loud noise',
      'A surge of excitement when a friend messages',
      'Remembering an embarrassing moment more vividly than an ordinary one',
    ],
    caveat:
      "Simplified associations for education only. The amygdala is not a 'fear center'; emotional life emerges from networks that include prefrontal, temporal and memory systems.",
  },
];

export const ACTIVITY_META: Record<ActivityKind, { label: string; description: string }> = {
  deep_focus: { label: 'Deep focus', description: 'Sustained, undistracted attention on one demanding task.' },
  active_recall: { label: 'Active recall', description: 'Testing yourself from memory instead of re-reading.' },
  spaced_repetition: { label: 'Spaced repetition', description: 'Reviewing material at expanding intervals over days and weeks.' },
  problem_solving: { label: 'Problem solving', description: 'Working through puzzles, exercises or open-ended problems.' },
  reading: { label: 'Reading', description: 'Focused reading of books, articles or documentation.' },
  skill_practice: { label: 'Skill practice', description: 'Hands-on repetition of a physical or technical skill.' },
  teaching: { label: 'Teaching', description: 'Explaining ideas to someone else, in your own words.' },
  exercise: { label: 'Exercise', description: 'Moving your body — walking, running, sports or strength work.' },
  mindfulness: { label: 'Mindfulness', description: 'Gently noticing thoughts, feelings and sensations in the present.' },
  social: { label: 'Social time', description: 'Meaningful connection with friends, family or community.' },
  creative: { label: 'Creative work', description: 'Making things — writing, drawing, designing, brainstorming.' },
  music: { label: 'Music', description: 'Playing, practicing or attentively listening to music.' },
  language_learning: { label: 'Language learning', description: 'Learning vocabulary, grammar and conversation in a new language.' },
  puzzles_games: { label: 'Puzzles & games', description: 'Working through crosswords, logic puzzles, board games or strategy games.' },
  new_hobby: { label: 'New hobby', description: 'Spending unhurried time practicing a craft, skill or personal hobby.' },
  novelty: { label: 'Tried something new', description: 'Exploring an unfamiliar place, recipe, topic or everyday experience.' },
  sleep_rest: { label: 'Sleep & rest', description: 'Sleeping and deliberate rest — the quiet half of learning.' },
};

/**
 * Illustrative educational weights (0..1), NOT empirically measured coefficients.
 * They express "this activity commonly involves these regions", nothing more.
 */
export const ACTIVITY_REGION_MAP: Record<ActivityKind, { region: RegionId; weight: number }[]> = {
  deep_focus: [{ region: 'prefrontal', weight: 1.0 }, { region: 'parietal', weight: 0.7 }],
  active_recall: [{ region: 'hippocampus', weight: 1.0 }, { region: 'prefrontal', weight: 0.8 }, { region: 'temporal', weight: 0.5 }],
  spaced_repetition: [{ region: 'hippocampus', weight: 1.0 }, { region: 'prefrontal', weight: 0.6 }, { region: 'temporal', weight: 0.5 }],
  problem_solving: [{ region: 'prefrontal', weight: 1.0 }, { region: 'parietal', weight: 0.8 }, { region: 'hippocampus', weight: 0.4 }],
  reading: [{ region: 'occipital', weight: 0.9 }, { region: 'temporal', weight: 0.8 }, { region: 'prefrontal', weight: 0.5 }],
  skill_practice: [{ region: 'cerebellum', weight: 1.0 }, { region: 'parietal', weight: 0.7 }, { region: 'prefrontal', weight: 0.6 }],
  teaching: [{ region: 'prefrontal', weight: 0.9 }, { region: 'temporal', weight: 0.8 }, { region: 'hippocampus', weight: 0.5 }],
  exercise: [{ region: 'cerebellum', weight: 1.0 }, { region: 'parietal', weight: 0.6 }],
  mindfulness: [{ region: 'prefrontal', weight: 0.8 }, { region: 'amygdala', weight: 0.6 }],
  social: [{ region: 'temporal', weight: 0.8 }, { region: 'prefrontal', weight: 0.7 }, { region: 'amygdala', weight: 0.5 }],
  creative: [{ region: 'prefrontal', weight: 0.8 }, { region: 'temporal', weight: 0.6 }, { region: 'hippocampus', weight: 0.4 }],
  music: [{ region: 'temporal', weight: 1.0 }, { region: 'cerebellum', weight: 0.7 }, { region: 'prefrontal', weight: 0.5 }],
  language_learning: [{ region: 'temporal', weight: 1.0 }, { region: 'hippocampus', weight: 0.7 }, { region: 'prefrontal', weight: 0.7 }],
  puzzles_games: [{ region: 'prefrontal', weight: 0.9 }, { region: 'parietal', weight: 0.7 }, { region: 'hippocampus', weight: 0.4 }],
  new_hobby: [{ region: 'prefrontal', weight: 0.7 }, { region: 'cerebellum', weight: 0.6 }, { region: 'hippocampus', weight: 0.5 }],
  novelty: [{ region: 'hippocampus', weight: 0.8 }, { region: 'prefrontal', weight: 0.7 }, { region: 'amygdala', weight: 0.4 }],
  sleep_rest: [{ region: 'hippocampus', weight: 0.9 }],
};

// Soft saturation: ~120 weighted minutes ≈ 0.95 intensity; the curve approaches 1
// asymptotically (1 - exp(-x/k)) so it never hard-clips. k = cap/3.
const SOFT_CAP_WEIGHTED_MIN = 120;
const CURVE_K = SOFT_CAP_WEIGHTED_MIN / 3;

export function activityToRegionIntensity(
  items: readonly { kind: ActivityKind; minutes: number }[],
): Partial<Record<RegionId, number>> {
  const totals = new Map<RegionId, number>();
  for (const item of items) {
    if (!Number.isFinite(item.minutes) || item.minutes <= 0) continue;
    for (const { region, weight } of ACTIVITY_REGION_MAP[item.kind]) {
      if (weight <= 0) continue;
      totals.set(region, (totals.get(region) ?? 0) + item.minutes * weight);
    }
  }
  const out: Partial<Record<RegionId, number>> = {};
  // Fixed iteration order → deterministic key order regardless of input ordering. Zeros omitted.
  for (const { id } of BRAIN_REGIONS) {
    const weighted = totals.get(id);
    if (weighted === undefined || weighted <= 0) continue;
    out[id] = 1 - Math.exp(-weighted / CURVE_K);
  }
  return out;
}
