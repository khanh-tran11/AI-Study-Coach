// Mock data matching the eventual DynamoDB schema
export const MOCK_LEARNER_PROGRESS = [
  { userId: 'user-1', name: 'Sarah Chen', moduleId: 'mod-1', stepsCompleted: 9, totalSteps: 9, timeSpentSeconds: 7200, lastActiveAt: '2026-07-22T10:30:00Z' },
  { userId: 'user-1', name: 'Sarah Chen', moduleId: 'mod-2', stepsCompleted: 5, totalSteps: 8, timeSpentSeconds: 4500, lastActiveAt: '2026-07-22T10:30:00Z' },
  { userId: 'user-2', name: 'Marcus Johnson', moduleId: 'mod-1', stepsCompleted: 6, totalSteps: 9, timeSpentSeconds: 5400, lastActiveAt: '2026-07-21T14:15:00Z' },
  { userId: 'user-2', name: 'Marcus Johnson', moduleId: 'mod-2', stepsCompleted: 0, totalSteps: 8, timeSpentSeconds: 0, lastActiveAt: '2026-07-21T14:15:00Z' },
  { userId: 'user-3', name: 'Elena Rodriguez', moduleId: 'mod-1', stepsCompleted: 9, totalSteps: 9, timeSpentSeconds: 6100, lastActiveAt: '2026-07-20T09:00:00Z' },
  { userId: 'user-3', name: 'Elena Rodriguez', moduleId: 'mod-2', stepsCompleted: 8, totalSteps: 8, timeSpentSeconds: 5800, lastActiveAt: '2026-07-20T09:00:00Z' },
  { userId: 'user-3', name: 'Elena Rodriguez', moduleId: 'mod-3', stepsCompleted: 4, totalSteps: 7, timeSpentSeconds: 3200, lastActiveAt: '2026-07-20T09:00:00Z' },
  { userId: 'user-4', name: 'David Park', moduleId: 'mod-1', stepsCompleted: 3, totalSteps: 9, timeSpentSeconds: 2100, lastActiveAt: '2026-07-19T16:45:00Z' },
  { userId: 'user-4', name: 'David Park', moduleId: 'mod-2', stepsCompleted: 0, totalSteps: 8, timeSpentSeconds: 0, lastActiveAt: '2026-07-19T16:45:00Z' },
  { userId: 'user-5', name: 'Priya Sharma', moduleId: 'mod-1', stepsCompleted: 9, totalSteps: 9, timeSpentSeconds: 5000, lastActiveAt: '2026-07-22T08:00:00Z' },
  { userId: 'user-5', name: 'Priya Sharma', moduleId: 'mod-2', stepsCompleted: 6, totalSteps: 8, timeSpentSeconds: 4200, lastActiveAt: '2026-07-22T08:00:00Z' },
  { userId: 'user-5', name: 'Priya Sharma', moduleId: 'mod-3', stepsCompleted: 7, totalSteps: 7, timeSpentSeconds: 5600, lastActiveAt: '2026-07-22T08:00:00Z' },
];

export const MODULE_NAMES = {
  'mod-1': 'Introduction to React',
  'mod-2': 'State Management with Context',
  'mod-3': 'Routing & Navigation',
  'mod-4': 'Accessibility in React',
  'mod-5': 'Working with APIs',
  'mod-6': 'Testing React Applications',
};
