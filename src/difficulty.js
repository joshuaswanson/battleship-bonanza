export const DIFFICULTIES = {
  easy: { pace: 0.93, catchUp: [0.8, 1.06], aggression: 0.6, medal: 'bronze' },
  normal: { pace: 1, catchUp: [0.8, 1.18], aggression: 1, medal: 'silver' },
  hard: { pace: 1.06, catchUp: [0.92, 1.24], aggression: 1.35, medal: 'gold' },
};
export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES);
export const MEDALS = ['bronze', 'silver', 'gold'];
