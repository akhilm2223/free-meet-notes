export type StudyAlertCategory = 'deadline' | 'action' | 'question' | 'important';

export interface StudyAlertCandidate {
  category: StudyAlertCategory;
  title: string;
  excerpt: string;
  matchedText: string;
  safeBody: string;
  priority: 'default' | 'high';
}

interface CategoryRule {
  category: StudyAlertCategory;
  title: string;
  safeBody: string;
  priority: 'default' | 'high';
  patterns: RegExp[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'deadline',
    title: 'Possible deadline',
    safeBody: 'A possible deadline was mentioned. Open Free Meet Notes to review it.',
    priority: 'high',
    patterns: [
      /\b(?:due|deadline|turn(?:ed)? in|hand(?:ed)? in)\b[^.!?]{0,90}\b(?:today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|class|midnight|noon|\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\b/i,
      /\b(?:submit|upload|send|finish|complete|read)\b[^.!?]{0,100}\bby\b[^.!?]{0,60}/i,
      /\b(?:due date|submission date|final day to submit)\b/i,
    ],
  },
  {
    category: 'action',
    title: 'Professor asked for something',
    safeBody: 'A possible class action or writing instruction was detected. Open Free Meet Notes to review it.',
    priority: 'high',
    patterns: [
      /\b(?:write|jot)\s+(?:this|that|it)\s+down\b/i,
      /\b(?:take|make)\s+(?:a\s+)?note\s+(?:of|that|about)\b/i,
      /\b(?:please|you(?:'ll|\s+will|\s+need|\s+have)\s+to|make sure (?:you|to))\b[^.!?]{0,110}\b(?:write|submit|upload|send|finish|complete|read|bring|email|prepare|review|practice|download|install)\b/i,
      /\b(?:your|the)\s+(?:assignment|homework|reading|worksheet|lab|project)\b[^.!?]{0,120}/i,
      /\b(?:for next class|before (?:the )?next class)\b/i,
    ],
  },
  {
    category: 'question',
    title: 'Question for the class',
    safeBody: 'A possible question for the class was detected. Open Free Meet Notes to see the transcript.',
    priority: 'default',
    patterns: [
      /\b(?:does|can|could|would)\s+(?:anyone|somebody|someone)\b[^.!?]{0,140}/i,
      /\b(?:who can tell me|raise your hand if|what do you think|why do you think|how would you|what would happen)\b[^.!?]{0,140}/i,
      /\b(?:akhil|class),?\s+(?:can|could|would|what|why|how|do|did|is|are)\b[^.!?]{0,140}/i,
    ],
  },
  {
    category: 'important',
    title: 'Important class note',
    safeBody: 'A possible key class point was detected. Open Free Meet Notes to review it.',
    priority: 'default',
    patterns: [
      /\b(?:this is|that is|here(?:'s| is))\s+(?:very\s+|really\s+)?important\b/i,
      /\b(?:key (?:point|concept|idea|takeaway)|main takeaway|remember that|note that)\b/i,
      /\b(?:will|may|might|could)\s+be\s+(?:on|in)\s+(?:the\s+)?(?:exam|quiz|test)\b/i,
      /\b(?:the exam|the quiz|the test)\b[^.!?]{0,100}\b(?:covers?|includes?|contains?|focuses? on)\b/i,
      /\b(?:the definition of|is defined as|in summary|to summarize)\b/i,
    ],
  },
];

const NEGATED_ACTION = /\b(?:do not|don't|does not|doesn't|no need to|not required to|won't need to)\s+(?:write|submit|upload|send|finish|complete|read|bring|email|prepare|review)\b/i;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function excerptAround(text: string, index: number): string {
  const start = Math.max(0, index - 45);
  const end = Math.min(text.length, index + 235);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

export function classifyStudyText(input: string): StudyAlertCandidate | null {
  const text = normalizeWhitespace(input);
  if (text.length < 8) return null;

  for (const rule of CATEGORY_RULES) {
    if (rule.category === 'action' && NEGATED_ACTION.test(text)) continue;

    for (const pattern of rule.patterns) {
      const match = pattern.exec(text);
      if (!match) continue;

      return {
        category: rule.category,
        title: rule.title,
        excerpt: excerptAround(text, match.index),
        matchedText: normalizeWhitespace(match[0]).slice(0, 180),
        safeBody: rule.safeBody,
        priority: rule.priority,
      };
    }
  }

  return null;
}

export function detailedAlertBody(candidate: StudyAlertCandidate): string {
  const prefix = candidate.category === 'question' ? 'Heard: ' : '';
  return `${prefix}${candidate.excerpt}`.slice(0, 360);
}

export class StudyAlertDetector {
  private context: string[] = [];
  private lastAlertAt = 0;
  private fingerprints = new Map<string, number>();

  reset(): void {
    this.context = [];
    this.lastAlertAt = 0;
    this.fingerprints.clear();
  }

  ingest(
    text: string,
    enabledCategories: Record<StudyAlertCategory, boolean>,
    minimumGapSeconds: number,
    now = Date.now(),
  ): StudyAlertCandidate | null {
    const cleanSegment = normalizeWhitespace(text);
    if (!cleanSegment) return null;

    this.context.push(cleanSegment);
    this.context = this.context.slice(-3);

    const candidate = classifyStudyText(cleanSegment) ?? classifyStudyText(this.context.join(' '));
    if (!candidate || !enabledCategories[candidate.category]) return null;

    // Clearing after a match prevents an old phrase in the rolling context from
    // firing again when the next transcript segment arrives.
    this.context = [];

    const normalizedMatch = candidate.matchedText.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const fingerprint = `${candidate.category}:${normalizedMatch}`;
    const previousMatch = this.fingerprints.get(fingerprint);
    if (previousMatch !== undefined && now - previousMatch < 10 * 60 * 1000) return null;

    const gapMs = Math.max(10, minimumGapSeconds) * 1000;
    if (candidate.category !== 'deadline' && now - this.lastAlertAt < gapMs) return null;

    this.lastAlertAt = now;
    this.fingerprints.set(fingerprint, now);
    for (const [key, timestamp] of this.fingerprints) {
      if (now - timestamp > 30 * 60 * 1000) this.fingerprints.delete(key);
    }

    return candidate;
  }
}
