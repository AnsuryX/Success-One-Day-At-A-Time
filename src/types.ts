export interface ToDoItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface MadeTimeItem {
  key: keyof MadeTimeFields;
  label: string;
  icon: string; // lucide icon name
}

export interface MadeTimeFields {
  healthyFood: boolean;
  yogaExercise: boolean;
  familyFriends: boolean;
  vitaminsMedicine: boolean;
  funHumor: boolean;
  workingGoals: boolean;
  quietNature: boolean;
  prayersSpirituality: boolean;
  givingOthers: boolean;
}

export interface DailyEntry {
  date: string; // YYYY-MM-DD
  challenge: string;
  result: string;
  commitToGoals: boolean;
  commitMonths: string;
  longTermGoals: string[]; // typically 3 items
  priorities: {
    high: string[]; // 2 items
    medium: string[]; // 2 items
    todo: ToDoItem[]; // 6 items by default
  };
  habits: { [key: string]: boolean }; // key is habit index
  spirit: { [key: string]: boolean }; // key is spirit index
  checkIn: {
    didDoGoals: string;
    supportiveThoughts: string;
    meditationDone: boolean;
  };
  madeTimeFor: MadeTimeFields;
  userId?: string;
  updatedAt?: any;
}
