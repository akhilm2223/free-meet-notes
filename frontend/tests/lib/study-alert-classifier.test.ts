import { describe, expect, test } from 'bun:test';
import {
  classifyStudyText,
  detailedAlertBody,
  StudyAlertDetector,
  type StudyAlertCategory,
} from '../../src/lib/study-alert-classifier';

const ALL_CATEGORIES: Record<StudyAlertCategory, boolean> = {
  deadline: true,
  action: true,
  question: true,
  important: true,
};

describe('study alert classifier', () => {
  test.each([
    ['The homework is due tomorrow at midnight.', 'deadline'],
    ['Please upload the worksheet by Friday.', 'deadline'],
    ['Write this down because we will use it later.', 'action'],
    ['Make sure you read chapter seven before the next class.', 'action'],
    ['Does anyone know why the result changes?', 'question'],
    ['Akhil, can you explain that step?', 'question'],
    ['This is very important for the final.', 'important'],
    ['The key takeaway is that correlation is not causation.', 'important'],
    ['This may be on the exam.', 'important'],
  ] as const)('classifies %s', (text, category) => {
    expect(classifyStudyText(text)?.category).toBe(category);
  });

  test.each([
    'Good morning, everyone.',
    'We are continuing the example from yesterday.',
    "You don't need to submit this worksheet.",
    'The lecture recording is already available.',
  ])('does not alert for ordinary or negated speech: %s', (text) => {
    expect(classifyStudyText(text)).toBeNull();
  });

  test('bounds detailed phone content', () => {
    const candidate = classifyStudyText(`Write this down ${'carefully '.repeat(80)}`);
    expect(candidate).not.toBeNull();
    expect(detailedAlertBody(candidate!).length).toBeLessThanOrEqual(360);
  });

  test('uses short rolling context for phrases split across transcript segments', () => {
    const detector = new StudyAlertDetector();
    expect(detector.ingest('This is', ALL_CATEGORIES, 20, 100_000)).toBeNull();
    expect(detector.ingest('very important for the final.', ALL_CATEGORIES, 20, 101_000)?.category).toBe('important');
  });

  test('deduplicates a repeated alert for ten minutes', () => {
    const detector = new StudyAlertDetector();
    expect(detector.ingest('The homework is due tomorrow.', ALL_CATEGORIES, 20, 100_000)?.category).toBe('deadline');
    expect(detector.ingest('The homework is due tomorrow.', ALL_CATEGORIES, 20, 200_000)).toBeNull();
    expect(detector.ingest('The homework is due tomorrow.', ALL_CATEGORIES, 20, 701_000)?.category).toBe('deadline');
  });

  test('respects disabled alert categories', () => {
    const detector = new StudyAlertDetector();
    expect(detector.ingest(
      'Does anyone know the answer?',
      { ...ALL_CATEGORIES, question: false },
      20,
      100_000,
    )).toBeNull();
  });
});
