// Coaching library: hand-verified free videos, channels and articles.
// Every URL below was checked against the live web before shipping —
// no search-result guessing, no dead links. YouTube items embed in-app
// (their license, their ads); articles open at the publisher.

export const TOPICS = [
  "breathing",
  "warmup",
  "pitch",
  "range",
  "control",
  "performance",
] as const;

export type Topic = (typeof TOPICS)[number];

export type ContentItem = {
  id: string;
  kind: "video" | "article" | "channel";
  title: string;
  source: string;
  url: string;
  minutes: number | null;
  topics: Topic[];
  forPlans: string[];
  blurb: string;
};

export const LIBRARY: ContentItem[] = [
  {
    id: "breath-support-basics",
    kind: "video",
    title: "How to Master Breathing As a Singer",
    source: "Ramsey Voice Studio",
    url: "https://www.youtube.com/watch?v=g6IHGyiujVg",
    minutes: 12,
    topics: ["breathing"],
    forPlans: ["first-week", "range-builder"],
    blurb: "Diaphragm support from zero — watch before day one.",
  },
  {
    id: "warmup-13",
    kind: "video",
    title: "13-Minute Vocal Warmup Tutorial",
    source: "Ramsey Voice Studio",
    url: "https://www.youtube.com/watch?v=U5NlHNWlKTQ",
    minutes: 13,
    topics: ["warmup"],
    forPlans: ["first-week", "range-builder"],
    blurb: "Daily warmup to play before every drill.",
  },
  {
    id: "on-pitch",
    kind: "video",
    title: "How to Sing On Pitch",
    source: "Vocal coach (verified)",
    url: "https://www.youtube.com/watch?v=fukE7zkdmq8",
    minutes: 10,
    topics: ["pitch"],
    forPlans: ["first-week"],
    blurb: "Why beginners drift sharp or flat — and the fix.",
  },
  {
    id: "range-no-strain",
    kind: "video",
    title: "How to Increase Your Vocal Range Without Strain",
    source: "Vocal coach (verified)",
    url: "https://www.youtube.com/watch?v=zBlnHVXYNUs",
    minutes: 11,
    topics: ["range"],
    forPlans: ["range-builder"],
    blurb: "Stretching edges safely — the companion to weeks two and three.",
  },
  {
    id: "pitch-fix-liepe",
    kind: "article",
    title: "Why Your Pitch is Bad (And How to Fix It)",
    source: "Chris Liepe",
    url: "https://chrisliepe.com/why-your-pitch-is-bad-and-how-to-fix-it/",
    minutes: 8,
    topics: ["pitch", "control"],
    forPlans: ["first-week", "range-builder"],
    blurb: "Hearing vs doing: the two halves of in-tune singing.",
  },
  {
    id: "breath-support-article",
    kind: "article",
    title: "Breath Support, Explained",
    source: "Singing Carrots",
    url: "https://singingcarrots.com/blog/breath-support-respiration",
    minutes: 6,
    topics: ["breathing"],
    forPlans: ["first-week"],
    blurb: "The physiology behind the exercises, plainly written.",
  },
  {
    id: "breathe-while-singing",
    kind: "article",
    title: "How to Breathe While Singing",
    source: "Singing Carrots",
    url: "https://blog.singingcarrots.com/how-to-breathe-while-singing-easy-breath-support-tips-for-beginners",
    minutes: 7,
    topics: ["breathing", "control"],
    forPlans: ["first-week", "range-builder"],
    blurb: "Beginner tips for keeping support through phrases.",
  },
  {
    id: "diaphragm-science",
    kind: "article",
    title: "Singing from Your Diaphragm",
    source: "Singing Carrots",
    url: "https://blog.singingcarrots.com/singing-from-your-diaphragm-the-science-and-stories-behind-breath-support",
    minutes: 9,
    topics: ["breathing", "performance"],
    forPlans: ["range-builder"],
    blurb: "Science plus stage stories for the long plan.",
  },
  {
    id: "extend-range-aimm",
    kind: "article",
    title: "How to Safely Extend Your Vocal Range",
    source: "Atlanta Institute of Music",
    url: "https://aimm.edu/blog/extend-your-vocal-range",
    minutes: 6,
    topics: ["range", "warmup"],
    forPlans: ["range-builder"],
    blurb: "Five proven tips that pair with the Builder weeks.",
  },
  {
    id: "expand-range-musicnotes",
    kind: "article",
    title: "Expand Your Vocal Range: 10 Tips",
    source: "Musicnotes",
    url: "https://www.musicnotes.com/blog/improve-vocal-range",
    minutes: 8,
    topics: ["range", "control"],
    forPlans: ["range-builder"],
    blurb: "Checklist format — pin it for week three.",
  },
  {
    id: "nyvc-channel",
    kind: "channel",
    title: "New York Vocal Coaching",
    source: "Justin Stoney",
    url: "https://www.youtube.com/@NewYorkVocalCoaching",
    minutes: null,
    topics: ["warmup", "control", "performance"],
    forPlans: ["first-week", "range-builder"],
    blurb: "A deep bench of free lessons for any stuck day.",
  },
  {
    id: "voicehacks-channel",
    kind: "channel",
    title: "VoiceHacks",
    source: "Mary Zimmer",
    url: "https://www.youtube.com/channel/UCQ8Imf-grdfjccLUcPLCSeA",
    minutes: null,
    topics: ["control", "performance", "pitch"],
    forPlans: ["first-week", "range-builder"],
    blurb: "Contemporary technique, especially strong on control.",
  },
  {
    id: "liepe-channel",
    kind: "channel",
    title: "Chris Liepe",
    source: "Chris Liepe",
    url: "https://www.youtube.com/@chrisliepe",
    minutes: null,
    topics: ["pitch", "range", "performance"],
    forPlans: ["range-builder"],
    blurb: "Pitch science for singers who like knowing why.",
  },
  {
    id: "ramsey-breathing-article",
    kind: "article",
    title: "Better Breathing for Singing",
    source: "Ramsey Voice Studio",
    url: "https://ramseyvoice.com/breathing-for-singing/",
    minutes: 5,
    topics: ["breathing", "warmup"],
    forPlans: ["first-week"],
    blurb: "Short companion read to the breathing video.",
  },
];
