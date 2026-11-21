import { describe, expect, it } from 'vitest';
import { joinSentence } from './compose.js';

describe('joinSentence', () => {
  it('starts the message with the first phrase', () => {
    expect(joinSentence('', 'I need water', 'en-IN')).toBe('I need water');
  });

  it('ends the previous sentence before adding the next one', () => {
    expect(joinSentence('I need water', 'Thank you', 'en-IN')).toBe('I need water. Thank you');
  });

  it('uses the right full stop for Bengali and Urdu', () => {
    expect(joinSentence('আমার জল চাই', 'ধন্যবাদ', 'bn-IN')).toBe('আমার জল চাই। ধন্যবাদ');
    expect(joinSentence('مجھے پانی چاہیے', 'شکریہ', 'ur-IN')).toBe('مجھے پانی چاہیے۔ شکریہ');
  });

  it('does not double a full stop or question mark already there', () => {
    expect(joinSentence('What time is it?', 'Goodbye', 'en-IN')).toBe('What time is it? Goodbye');
    expect(joinSentence('I need water.  ', 'Thank you', 'en-IN')).toBe('I need water. Thank you');
  });
});
