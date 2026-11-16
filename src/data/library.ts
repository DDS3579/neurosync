import type { RegionId } from '@/types/domain';

export type LibraryCategory = 'region' | 'sleep' | 'learning' | 'movement' | 'nutrition' | 'wellbeing';

export interface LibraryEntry {
  id: string;
  category: LibraryCategory;
  title: string;
  summary: string;
  body: string[];
  keyPoints: string[];
  caveat: string;
  relatedRegions?: RegionId[];
}

/**
 * Static educational reading. General findings are described qualitatively —
 * no citations, no invented statistics, no structural-change claims, no targets.
 */
export const LIBRARY_ENTRIES: LibraryEntry[] = [
  {
    id: 'region-prefrontal',
    category: 'region',
    title: 'Prefrontal cortex: the planner',
    summary: 'The area behind your forehead that is commonly associated with planning, focus and self-regulation.',
    body: [
      "The prefrontal cortex is the front-most part of the brain, sitting just behind your forehead. It is commonly associated with the things we call 'executive functions': setting goals, holding information in mind, weighing options, and steering attention away from distractions.",
      'It does not work alone. Planning and focus emerge from networks that link the prefrontal cortex with the parietal lobe and many other areas. It is also one of the last regions to finish maturing — development continues into the twenties.',
      'You use these circuits when you decide what to work on first, when you hold a number in mind while searching for a pen, or when you notice an urge to check your phone and choose to keep reading.',
    ],
    keyPoints: [
      'Commonly associated with planning, working memory and attention control.',
      'Works in networks, especially with the parietal lobe.',
      'Keeps maturing into the twenties.',
      'Educational association only — this app does not measure it.',
    ],
    caveat: 'A simplified educational overview. Functions emerge from networks, not single regions, and nothing in this app measures your brain.',
    relatedRegions: ['prefrontal'],
  },
  {
    id: 'region-parietal',
    category: 'region',
    title: 'Parietal lobe: the map-maker',
    summary: 'The top-back region commonly associated with touch, spatial sense and directing attention.',
    body: [
      'The parietal lobe sits at the top and back of the cortex. It is commonly associated with combining signals from touch, muscles and joints into a sense of where your body is, and with building an internal map of the space around you.',
      'It also helps aim attention — toward a location, an object, or even a number. Mental arithmetic, mental rotation and packing a bag all draw on parietal networks working with the frontal lobes.',
      'You use these circuits when you reach for a mug without looking, judge whether a book will fit on a shelf, or track a ball across a field.',
    ],
    keyPoints: [
      'Commonly associated with touch, body position and spatial maps.',
      'Helps direct attention to places and objects.',
      'Contributes to number sense and mental arithmetic.',
    ],
    caveat: 'A simplified educational overview. Touch and spatial attention emerge from networks across several lobes, and this app does not measure them.',
    relatedRegions: ['parietal'],
  },
  {
    id: 'region-temporal',
    category: 'region',
    title: 'Temporal lobe: sound and meaning',
    summary: 'The side regions commonly associated with hearing, language and recognition.',
    body: [
      'The temporal lobes sit along the sides of the brain, roughly behind your ears. They are commonly associated with processing sound, understanding speech, and recognizing what you see — faces, objects and words.',
      'The inner (medial) temporal lobe contains the hippocampus and neighboring areas that are closely tied to forming new memories. That is why this lobe matters for both understanding a sentence today and remembering it tomorrow.',
      "You use these circuits when you recognize a friend's voice on a call, follow a podcast, or pick out a familiar face in a crowd.",
    ],
    keyPoints: [
      'Commonly associated with hearing and language comprehension.',
      'Helps recognize faces, objects and words.',
      'Its medial parts are closely tied to memory.',
    ],
    caveat: 'Simplified educational associations. Language and recognition depend on networks that extend well beyond the temporal lobe.',
    relatedRegions: ['temporal', 'hippocampus'],
  },
  {
    id: 'region-occipital',
    category: 'region',
    title: 'Occipital lobe: the visual hub',
    summary: 'The back of the brain, where visual processing begins.',
    body: [
      'The occipital lobe sits at the very back of the brain. It is the main hub for early visual processing: analyzing edges, contrast, color and motion from the signals arriving from your eyes.',
      "From there, information flows along two broad routes — a 'what' pathway into the temporal lobe for recognizing things, and a 'where/how' pathway into the parietal lobe for locating them and acting on them. Seeing is a team effort.",
      'You use these circuits when you read a page, spot a friend across a busy street, or watch where a ball is heading.',
    ],
    keyPoints: [
      'Main hub for early visual processing.',
      "Feeds the 'what' and 'where/how' pathways.",
      'Reading starts here, then spreads through a network.',
    ],
    caveat: 'A simplified educational sketch. Vision is built by networks spanning several lobes, and nothing here measures your visual system.',
    relatedRegions: ['occipital', 'temporal', 'parietal'],
  },
  {
    id: 'region-cerebellum',
    category: 'region',
    title: 'Cerebellum: the quiet coordinator',
    summary: "The 'little brain' that fine-tunes movement — and maybe more.",
    body: [
      'The cerebellum is a densely folded structure tucked under the back of the cortex. Although it is small, it contains more neurons than the rest of the brain combined.',
      'It is best known for coordination: smoothing movement, keeping balance, and helping practiced skills — riding a bike, typing, playing an instrument — become automatic. It compares what you intended with what happened and fine-tunes the difference.',
      'Research also links the cerebellum to loops involved in attention, language and prediction. Those roles are still being explored, so treat them as interesting leads rather than settled facts.',
    ],
    keyPoints: [
      'Commonly associated with coordination, balance and motor learning.',
      'Contains more neurons than the rest of the brain combined.',
      'Possible roles in thinking are an active research area.',
    ],
    caveat: 'Simplified educational associations. The cerebellum works in networks of loops with the cortex, and its cognitive roles are still being researched.',
    relatedRegions: ['cerebellum', 'prefrontal'],
  },
  {
    id: 'region-hippocampus',
    category: 'region',
    title: 'Hippocampus: the memory indexer',
    summary: 'A deep structure commonly associated with forming new memories and finding your way.',
    body: [
      "The hippocampus is a seahorse-shaped structure deep inside each temporal lobe — you would not see it looking at the brain's surface. It is commonly associated with forming new memories of events and facts, and with spatial navigation.",
      'A useful way to think about it: the hippocampus is an indexer, not a warehouse. It binds the sights, sounds and context of an experience into one memory, while the pieces themselves are thought to live across the cortex. Over time — and with sleep — memories become less dependent on it.',
      'Its importance became famous through a patient known as H.M., who could no longer form new memories after surgery removed both hippocampi and nearby tissue. Older memories and skills were largely spared, which told researchers a great deal about how memory is organized.',
    ],
    keyPoints: [
      'Commonly associated with new event and fact memories, and with navigation.',
      'Deep structure — one in each hemisphere.',
      "Think 'indexer', not 'storage vault'.",
      'Logging habits does not measure your hippocampus.',
    ],
    caveat: 'Simplified educational overview. Memory depends on networks linking the hippocampus with the cortex; this app cannot measure any of it.',
    relatedRegions: ['hippocampus', 'temporal'],
  },
  {
    id: 'region-amygdala',
    category: 'region',
    title: 'Amygdala: the salience flagger',
    summary: 'A deep structure that flags what matters emotionally — not just fear.',
    body: [
      'The amygdala is an almond-shaped cluster of nuclei deep inside each temporal lobe, next to the hippocampus. It is commonly associated with detecting emotional significance: noticing what might threaten you, but also what might reward or delight you.',
      "The popular 'fear center' label is too narrow. The amygdala works in networks with the prefrontal cortex (which helps regulate reactions) and the hippocampus (which supplies context), and emotional events are often remembered more vividly because of this teamwork.",
      'You notice these circuits when you jump at a sudden noise, feel a surge of excitement at a message from a friend, or recall an embarrassing moment far more clearly than an ordinary one.',
    ],
    keyPoints: [
      'Commonly associated with emotional significance, threat and reward.',
      "Not a 'fear center' — it works in networks.",
      'Emotional events are often remembered more vividly.',
    ],
    caveat: 'Simplified associations for education only. Emotional life emerges from networks, and this app measures none of them.',
    relatedRegions: ['amygdala', 'prefrontal', 'hippocampus'],
  },
  {
    id: 'sleep-and-memory',
    category: 'sleep',
    title: 'Sleep and memory: the night shift',
    summary: 'Sleep is commonly associated with stabilizing and reorganizing what you learned during the day.',
    body: [
      'Learning does not stop when you close your books. During sleep, the brain replays and reorganizes recent experiences, and research commonly links deep (slow-wave) sleep with stabilizing memories of facts and events.',
      'A widely studied picture is a quiet dialogue: the hippocampus re-activates fresh memories and the cortex gradually integrates them into longer-term knowledge. REM sleep — the dreaming stage — may also play a role in emotional processing and skill memory, though the details are still debated.',
      'Practically, this means sleep before learning helps you take information in, and sleep after learning helps it settle. For reference, guidelines commonly suggest 8–10 hours for teens and 7 or more for adults — a reference point, not a verdict; your own target is yours to set.',
    ],
    keyPoints: [
      'Deep sleep is commonly associated with consolidating facts and events.',
      'Sleep before and after learning both matter.',
      'Reference ranges are references, not verdicts.',
      'One short night does not define your rest.',
    ],
    caveat: 'Educational summary of general research, not medical advice. Sleep needs vary between people, and this app does not measure memory or brain activity.',
    relatedRegions: ['hippocampus', 'temporal'],
  },
  {
    id: 'sleep-consistency',
    category: 'sleep',
    title: 'A steady rhythm: sleep timing',
    summary: 'Regular sleep and wake times are commonly associated with easier sleep and steadier days.',
    body: [
      'Your body runs on an internal roughly-24-hour clock that governs sleepiness, alertness, temperature and more. It loves predictability: going to bed and waking at roughly similar times is commonly associated with falling asleep more easily and feeling steadier during the day.',
      "Light is the clock's main signal. Bright light in the morning and dimmer light in the evening help anchor the rhythm. Big swings between weekday and weekend schedules — sometimes called 'social jet lag' — can leave you feeling like you crossed time zones without going anywhere.",
      'If your schedule is chaotic right now, that is information, not a flaw. Small, boring adjustments — a consistent wake time, a wind-down cue — tend to be more sustainable than dramatic overhauls.',
    ],
    keyPoints: [
      'Similar bed and wake times support a steady body clock.',
      'Morning light and dim evenings are the main anchors.',
      'Big weekend swings can feel like jet lag.',
      'Gentle consistency beats dramatic overhauls.',
    ],
    caveat: 'General educational information, not medical advice. Rhythms shift with life circumstances; nothing here is a rule to keep.',
  },
  {
    id: 'spaced-repetition',
    category: 'learning',
    title: 'Spaced repetition: let time do some work',
    summary: 'Reviewing at expanding intervals is one of the most reliable ways to make learning last.',
    body: [
      'The spacing effect is one of the oldest findings in psychology: information reviewed across several sessions spread over days and weeks is remembered far better than the same amount of review crammed into one sitting. Researchers have been documenting it for well over a century.',
      'The trick is to review just as a memory starts to fade. A little forgetting makes the next retrieval effortful, and that effort appears to be part of what makes the memory more durable. Each successful review tends to buy you a longer gap before the next one.',
      'In practice: short reviews tomorrow, then in a few days, then next week. Flashcards and self-quizzes pair naturally with this rhythm — and with the focus sessions you log here.',
    ],
    keyPoints: [
      'Spread reviews over days and weeks, not one cram.',
      'Review when recall starts to feel effortful.',
      'Successful reviews allow longer gaps.',
      'Pairs naturally with active recall.',
    ],
    caveat: 'A general learning principle, not a guarantee for every person or subject. This app tracks your practice; it does not measure your memory.',
    relatedRegions: ['hippocampus', 'prefrontal'],
  },
  {
    id: 'active-recall',
    category: 'learning',
    title: 'Active recall: the testing effect',
    summary: 'Pulling information out of memory is usually more effective than putting it in again.',
    body: [
      'Re-reading feels productive because the text becomes familiar. But familiarity is not the same as being able to produce an answer from memory. A large body of research shows that testing yourself — retrieving — usually leads to better long-term retention than re-studying the same material.',
      'The effort is the point. Struggling to recall an answer, then checking it, is a feature rather than a bug: mistakes show you exactly where the gaps are, and successful effortful retrieval makes future recall easier.',
      'Simple versions: close the book and write what you remember; turn headings into questions; explain the idea out loud without notes. Then check, correct, and move on.',
    ],
    keyPoints: [
      'Retrieval beats re-reading for long-term retention.',
      'Effort and mistakes are part of the mechanism.',
      'Always check your answers afterward.',
      'Familiarity can fool you into feeling ready.',
    ],
    caveat: 'General educational guidance. Effects vary by material and person, and nothing here measures what your brain is doing.',
    relatedRegions: ['hippocampus', 'prefrontal'],
  },
  {
    id: 'interleaving',
    category: 'learning',
    title: 'Interleaving: mix it up',
    summary: 'Mixing related topics during practice often leads to more flexible learning.',
    body: [
      'Blocked practice means doing many problems of the same type in a row; interleaving means mixing types so you must decide which approach fits each problem. Mixing usually feels harder and slower — and that is exactly why it can help.',
      'Research on math practice and category learning suggests interleaving often improves the skill that real life demands: telling situations apart and choosing the right tool, not just executing a known procedure.',
      'It is not a universal law. When a skill is brand new, some blocked practice can help you get the basics before mixing. A reasonable rhythm is: learn the move, then shuffle the deck.',
    ],
    keyPoints: [
      'Mixing related problem types builds discrimination.',
      'It feels harder than blocked practice — that is expected.',
      'Use some blocking when a skill is brand new.',
      'Best studied in math and category learning.',
    ],
    caveat: 'A hedged summary of general findings; benefits depend on the material and the learner. Not a measurement of your learning.',
    relatedRegions: ['prefrontal'],
  },
  {
    id: 'deliberate-practice',
    category: 'learning',
    title: 'Deliberate practice: practice with a target',
    summary: 'Focused work on a specific weak point, with feedback, beats autopilot repetition.',
    body: [
      'Deliberate practice is a structured way to improve: pick one specific sub-skill just beyond your current ability, work on it with full attention, get feedback, and repeat. It is different from simply putting in hours or playing through what you already do well.',
      'Feedback is the engine — a coach, a recording, a test, or a compiler all tell you what actually happened versus what you intended. Short, focused sessions with rest between them tend to be more sustainable than marathons.',
      'How much practice matters varies by field, and improvement is rarely a straight line. Treat the framework as a useful lens for your sessions, not a promise of results.',
    ],
    keyPoints: [
      'Target one sub-skill just beyond your reach.',
      'Feedback separates practice from repetition.',
      'Rest between sessions is part of the method.',
      'Hours alone do not guarantee improvement.',
    ],
    caveat: 'A general framework, not a formula. The link between practice and outcomes varies across fields and people.',
    relatedRegions: ['prefrontal', 'cerebellum'],
  },
  {
    id: 'attention-and-breaks',
    category: 'learning',
    title: 'Attention, distractions and breaks',
    summary: 'Attention is limited and fluctuates — working with that beats fighting it.',
    body: [
      'Sustained attention is a limited resource that naturally ebbs and flows. Most people find their focus drifts during long, unbroken stretches, and that short breaks help them return fresher. There is no universal ideal session length — your logs can help you find yours.',
      "Switching tasks has a cost: each switch leaves a little 'residue' from the previous task, and re-immersion takes time. Grouping similar work and silencing pings are boring, effective moves.",
      'Breaks work best when they actually change mode: stand up, look out of a window, walk a little, breathe. Scrolling a feed is a break from work, but not always a break for attention.',
    ],
    keyPoints: [
      'Focus fluctuates; that is normal, not a flaw.',
      'Task-switching has a real cost.',
      'Short mode-changing breaks help many people.',
      'Your own logs beat generic productivity rules.',
    ],
    caveat: 'General educational information with individual variation. This app does not measure attention; ratings are your own reflections.',
    relatedRegions: ['prefrontal', 'parietal'],
  },
  {
    id: 'exercise-and-cognition',
    category: 'movement',
    title: 'Movement and thinking',
    summary: 'Physical activity is commonly associated with mood and attention benefits — no hype required.',
    body: [
      'Many people notice that a walk or a workout leaves them feeling clearer and calmer for a while afterward. Short-term mood benefits are among the more consistent findings; effects on attention and thinking are real but more modest and variable.',
      'Over the longer term, regular physical activity is associated with better cognitive aging in population studies. Association is not proof of cause — people who move more may differ in many ways — so treat this as encouraging, not as a prescription.',
      "Movement also trains the cerebellum's coordination circuits every time you practice a sport, a dance, or even a new walking route. And the best activity for your brain is probably the one you will actually keep doing: something you enjoy.",
    ],
    keyPoints: [
      'Short-term mood lift is a consistent finding.',
      'Long-term links to cognitive aging are associations, not proof.',
      'Coordination skills draw on the cerebellum.',
      'Enjoyment beats intensity for consistency.',
    ],
    caveat: 'Educational summary, not medical or training advice. No claim here measures or predicts changes in your brain.',
    relatedRegions: ['cerebellum', 'prefrontal'],
  },
  {
    id: 'hydration-basics',
    category: 'nutrition',
    title: 'Hydration without the hype',
    summary: 'Water matters, but needs vary — thirst is a reasonable guide for most people.',
    body: [
      'Every cell needs water, and the brain is no exception. Some research suggests that even mild dehydration may nudge mood and attention in the wrong direction, though findings vary and the effects are usually small.',
      "The famous 'eight glasses a day' rule is not a scientific requirement. Needs depend on your body, the weather, activity and food — many fruits and meals contribute plenty of water. For most healthy people, drinking when thirsty works well.",
      'A simple, pressure-free approach: keep water within reach, drink with meals, and pay a little extra attention on hot or active days. No targets, no pressure — just noticing what helps you feel steady.',
    ],
    keyPoints: [
      'Mild dehydration may affect mood and attention.',
      'Needs vary; the 8-glasses rule is not a requirement.',
      'Thirst is a reasonable guide for most healthy people.',
      'Food contributes water too.',
    ],
    caveat: 'General information, not medical advice. Some health conditions and situations change fluid needs; ask a professional when unsure.',
  },
  {
    id: 'balanced-eating',
    category: 'nutrition',
    title: 'Adequacy, balance, moderation, variety',
    summary: 'Four old, sensible principles for eating well — with no numbers to chase.',
    body: [
      'The brain runs on a steady supply of fuel from food, and it does best when the whole body is well nourished. Instead of targets, many nutrition educators lean on four principles: adequacy (enough food and nutrients), balance (no single food group crowding out the others), moderation (nothing to excess), and variety (different foods across days and weeks).',
      'Regular meals are one gentle form of structure: some people find their energy and mood feel steadier when they eat at roughly consistent times. Others do fine with flexible patterns — there is no single correct schedule.',
      'No food is a moral category. Culture, budget, appetite and joy all belong at the table. This app asks only a few yes/no questions about your day, because noticing patterns is useful while chasing numbers often is not.',
    ],
    keyPoints: [
      'Adequacy, balance, moderation, variety — no counting.',
      'The brain depends on steady fuel from food.',
      'Regular meals help some people feel steadier.',
      'No good/bad food labels here.',
    ],
    caveat: 'General educational principles, not dietary advice or targets. Individual needs differ; consult a professional for personal guidance.',
  },
  {
    id: 'stress-and-breathing',
    category: 'wellbeing',
    title: 'Stress and slow breathing',
    summary: 'Stress is a protective response — and slow breathing is one gentle way to work with it.',
    body: [
      "Stress is your body's way of mobilizing for a challenge: heart rate rises, attention narrows, energy is redirected. In short bursts it is protective and useful. The amygdala helps flag what matters emotionally, while prefrontal networks help you appraise and regulate the reaction.",
      'Breathing is one of the few levers you can pull directly. Many people find that slowing down — especially making the exhale longer than the inhale for a minute or two — is associated with feeling calmer. Research on slow breathing suggests modest, short-term calming effects; it is a tool, not a treatment.',
      'Try it small: breathe in gently for about four counts, out for about six, for a minute. If it feels uncomfortable, stop — there is no prize for forcing it. And if stress feels big or persistent, talking to someone you trust or a professional is a strength, not a last resort.',
    ],
    keyPoints: [
      'Stress is protective in short bursts.',
      'Longer exhales are associated with calming for many people.',
      'Effects are modest and short-term — a tool, not a treatment.',
      'Persistent stress deserves real-world support.',
    ],
    caveat: 'Educational information, not medical or psychological advice. If stress is affecting your daily life, consider talking to a qualified professional.',
    relatedRegions: ['amygdala', 'prefrontal'],
  },
  {
    id: 'novelty-and-hobbies',
    category: 'wellbeing',
    title: 'Novelty, hobbies and the learning brain',
    summary: 'New, enjoyable activities engage attention and memory — and are worth doing for their own sake.',
    body: [
      'Learning a song, a language, a craft or a climbing route asks your attention and memory systems to work together on something unfamiliar. Novelty tends to recruit focus; meaningful, enjoyable goals tend to keep it there.',
      'Hobbies are low-stakes practice fields. Because nobody is grading you, you can afford the mistakes that learning requires — and the enjoyment itself is a reason, not just a means to an end.',
      "An honest caveat lives here: doing new things is not a magic formula for a 'better brain', and nothing in this app can measure such a thing. The reliable pitch for hobbies is simpler — they make life richer, and they give your learning circuits something worth practicing on.",
    ],
    keyPoints: [
      'Novelty engages attention and memory systems.',
      'Enjoyment supports persistence.',
      'Hobbies are worth doing for their own sake.',
      'No app can measure brain changes from habits.',
    ],
    caveat: 'Educational perspective, not a promise of cognitive benefits. Associations here are general and simplified.',
    relatedRegions: ['hippocampus', 'prefrontal'],
  },
];
