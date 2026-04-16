import type { TranscriptEntry } from '../demo/transcript';
import type { SlackStoryBeat } from '../demo/slack-story';

const renderBody = (entry: TranscriptEntry) =>
  entry.body ? `${entry.summary}\n${entry.body}` : entry.summary;

const renderMentions = (entry: TranscriptEntry) =>
  entry.mentions.length > 0 ? `\n${entry.mentions.join(' ')}` : '';

export const renderSlackMessage = (entry: TranscriptEntry) =>
  `${renderBody(entry)}${renderMentions(entry)}`.trim();

export const renderSlackBeat = (beat: SlackStoryBeat) => beat.text.trim();
