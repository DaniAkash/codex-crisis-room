import type { TranscriptEntry } from '../demo/transcript';

const renderBody = (entry: TranscriptEntry) =>
  entry.body ? `${entry.summary}\n${entry.body}` : entry.summary;

const renderMentions = (entry: TranscriptEntry) =>
  entry.mentions.length > 0 ? `\n${entry.mentions.join(' ')}` : '';

export const renderSlackMessage = (entry: TranscriptEntry) =>
  `${renderBody(entry)}${renderMentions(entry)}`.trim();
