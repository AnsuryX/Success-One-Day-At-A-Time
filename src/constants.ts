import { DailyEntry } from "./types";

export const SUCCESS_HABITS = [
  "Followed my intuition",
  "Limited distractions",
  "Set clear and tangible goals",
  "Learned from my mistakes",
  "Scheduled goals within a time frame",
  "Chose goals that motivate me",
  "Looked for the positive in every situation",
  "Took action despite fear",
  "Surrounded myself with positive people",
  "Did what I am passionate about",
  "Took full responsibility for my choices",
  "Believed in myself and my vision",
  "Reached out for help when needed"
];

export const HEALTHY_MIND_SPIRIT = [
  "Didn't jump to conclusions",
  "Practiced patience",
  "Accepted what I couldn't change",
  "Didn't judge others",
  "Didn't judge myself",
  "Was aware of negative thoughts",
  "Caught myself rushing & slowed down",
  "Practiced active listening",
  "Quieted my mind / meditated",
  "Didn't undermine my value",
  "Felt gratitude for what I have"
];

export const MADE_TIME_ITEMS = [
  { key: "healthyFood", label: "HEALTHY FOOD / WATER", icon: "UtensilsCrossed" },
  { key: "yogaExercise", label: "YOGA / EXERCISE", icon: "Activity" },
  { key: "familyFriends", label: "FAMILY / FRIENDS", icon: "Users" },
  { key: "vitaminsMedicine", label: "VITAMINS / MEDICINE", icon: "Pill" },
  { key: "funHumor", label: "FUN & HUMOR", icon: "Smile" },
  { key: "workingGoals", label: "WORKING ON GOALS", icon: "Target" },
  { key: "quietNature", label: "QUIET / NATURE", icon: "Trees" },
  { key: "prayersSpirituality", label: "PRAYERS / SPIRITUALITY", icon: "Sparkles" },
  { key: "givingOthers", label: "GIVING TO OTHERS", icon: "HeartHandshake" }
] as const;

export function getEmptyEntry(date: string): DailyEntry {
  return {
    date,
    challenge: "",
    result: "",
    commitToGoals: false,
    commitMonths: "",
    longTermGoals: ["", "", ""],
    priorities: {
      high: ["", ""],
      medium: ["", ""],
      todo: [
        { id: "1", text: "", completed: false },
        { id: "2", text: "", completed: false },
        { id: "3", text: "", completed: false },
        { id: "4", text: "", completed: false },
        { id: "5", text: "", completed: false },
        { id: "6", text: "", completed: false }
      ]
    },
    habits: SUCCESS_HABITS.reduce((acc, _, idx) => {
      acc[idx] = false;
      return acc;
    }, {} as { [key: string]: boolean }),
    spirit: HEALTHY_MIND_SPIRIT.reduce((acc, _, idx) => {
      acc[idx] = false;
      return acc;
    }, {} as { [key: string]: boolean }),
    checkIn: {
      didDoGoals: "",
      supportiveThoughts: "",
      meditationDone: false
    },
    madeTimeFor: {
      healthyFood: false,
      yogaExercise: false,
      familyFriends: false,
      vitaminsMedicine: false,
      funHumor: false,
      workingGoals: false,
      quietNature: false,
      prayersSpirituality: false,
      givingOthers: false
    }
  };
}

export interface MotivationalQuote {
  text: string;
  author: string;
  coachingTip: string;
}

export const MOTIVATIONAL_QUOTES: MotivationalQuote[] = [
  {
    text: "The secret of your future is hidden in your daily routine.",
    author: "Mike Murdock",
    coachingTip: "Look at your checklists today. What single minor habit shift can you prioritize to align with your long-term vision?"
  },
  {
    text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle",
    coachingTip: "Focus on ticking your daily habits checkmarks. Consistency compounds. Every completed item is a mark of excellence."
  },
  {
    text: "You do not rise to the level of your goals. You fall to the level of your systems.",
    author: "James Clear",
    coachingTip: "Your daily planner is your system. Focus on refining your action steps rather than worrying about the mountain ahead."
  },
  {
    text: "One-day-at-a-time is the secret to moving mountains.",
    author: "Universal Wisdom",
    coachingTip: "Keep your vision focused purely within the boundaries of 'today.' Yesterday is history; tomorrow doesn't exist yet."
  },
  {
    text: "Be not afraid of going slowly, be afraid only of standing still.",
    author: "Chinese Proverb",
    coachingTip: "Even if your completion score is low today, the fact that you opened this planner and logged progress is a step forward."
  },
  {
    text: "The critical ingredient is getting off your butt and doing something, simple as that.",
    author: "Nolan Bushnell",
    coachingTip: "Pick one high-priority goal from your list and work on it for just 10 minutes without checking social media."
  },
  {
    text: "A year from now you will wish you had started today.",
    author: "Karen Lamb",
    coachingTip: "The success entries you record this afternoon are the concrete building blocks of your transformation next year."
  },
  {
    text: "It is not the mountain we conquer, but ourselves.",
    author: "Sir Edmund Hillary",
    coachingTip: "Today's main challenge isn't an external event; it is managing your own thoughts, emotions, and responses."
  },
  {
    text: "Do first things first, and second things not at all.",
    author: "Peter Drucker",
    coachingTip: "Look closely at your prioritization grid. Are you hiding in medium-priority tasks to avoid your high-priority items?"
  },
  {
    text: "The best way to predict the future is to create it.",
    author: "Peter Drucker",
    coachingTip: "Every checkbox you fill today is an active design decision for the type of user, creator, or person you want to become."
  }
];

