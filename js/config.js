// Game constants — values carried over from the original VeCo (2019, MainWindow.cs)
export const ROUND_BASE_MS = 10000;   // round budget = ROUND_BASE_MS - level * MS_PER_LEVEL
export const MS_PER_LEVEL = 10;
export const MAX_ITEMS = 20;
export const GRID_COLS = 4;
export const GRID_ROWS = 5;
export const FOOD_MIN = 1;            // 000.png is the blank placeholder
export const FOOD_MAX = 119;          // original drew rand.Next(1, 120)
export const DIFF_PROBABILITY = 0.5;

// New in the remake
export const TIME_ATTACK_MS = 60000;
export const FLASH_MS = 200;

export const LABELS = {
  title: 'VeCo',
  subtitle: 'VEgetable COmpare',
  level: 'Level',
  time: 'Time',
  right: 'Right',
  wrong: 'Wrong',
  points: 'Points',
  best: 'Best',
  statistics: 'Statistics',
  credits: 'Credits',
  endless: 'Endless',
  timeAttack: 'Time Attack',
  shuffle: 'Shuffle',
  paused: 'Paused',
  tapToResume: 'tap to resume',
  timesUp: "Time's up!",
  finalScore: 'Final score',
  newBest: 'New best!',
  playAgain: 'Play again',
  menu: 'Menu',
  rounds: 'Rounds',
  accuracy: 'Accuracy',
  playTime: 'Play time',
  howToSame: 'same → swipe right or ✓',
  howToDiff: 'different → swipe left or ✗',
  howToIntro: 'Does the cart match the list?',
};

export const foodSrc = (id) => `assets/foods/${String(id).padStart(3, '0')}.png`;
