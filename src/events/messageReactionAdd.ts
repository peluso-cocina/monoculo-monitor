import { Events, type MessageReaction, type User } from 'discord.js';
import { getDatabase } from '../database/client.js';
import { saveReaction } from '../database/backlogRepository.js';
import { buildFallback, extractFirstUrl, extractRelease } from '../services/metadataService.js';
import type { BotEvent, ReactionPayload } from '../types/index.js';

export const MEMO_EMOJI = '📝';
export const UNKNOWN_MESSAGE_CODE = 10008;

export interface ReactionFilterInput {
  userIsBot: boolean;
  authorIsBot: boolean;
  inGuild: boolean;
  emojiName: string | null;
}

export function shouldProcessReaction(input: ReactionFilterInput): boolean {
  return (
    input.inGuild && !input.userIsBot && !input.authorIsBot && input.emojiName === MEMO_EMOJI
  );
}

export interface PayloadSource {
  messageId: string;
  channelId: string;
  authorId: string;
  content: string;
  embedUrl: string | null;
  roleNames: string[];
}

export function buildReactionPayload(source: PayloadSource, userId: string): ReactionPayload {
  return {
    messageId: source.messageId,
    channelId: source.channelId,
    authorId: source.authorId,
    userId,
    content: source.content,
    embedUrl: source.embedUrl,
    firstRoleName: source.roleNames[0] ?? null,
  };
}

export function isUnknownMessageError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as Record<string, unknown>)['code'] === UNKNOWN_MESSAGE_CODE;
}

async function handleMemoReaction(reaction: MessageReaction, user: User): Promise<void> {
  try {
    const preFilter = shouldProcessReaction({
      userIsBot: user.bot,
      authorIsBot: reaction.message.author?.bot ?? false,
      inGuild: reaction.message.guildId !== null,
      emojiName: reaction.emoji.name,
    });
    if (!preFilter) return;

    const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
    const message = fullReaction.message.partial
      ? await fullReaction.message.fetch()
      : fullReaction.message;

    const content = message.content ?? '';
    const rawEmbedUrl = message.embeds[0]?.url ?? null;
    const embedUrl = rawEmbedUrl !== null && /^https?:\/\//i.test(rawEmbedUrl) ? rawEmbedUrl : null;
    const url = extractFirstUrl(content, embedUrl);
    const roleNames = [...message.mentions.roles.values()].map((role) => role.name);
    const payload = buildReactionPayload(
      {
        messageId: message.id,
        channelId: message.channelId,
        authorId: message.author?.id ?? 'unknown',
        content,
        embedUrl,
        roleNames,
      },
      user.id,
    );

    const meta = url === null ? buildFallback(content, null) : (await extractRelease(url)) ?? buildFallback(content, url);
    saveReaction(getDatabase(), {
      userId: payload.userId,
      messageId: payload.messageId,
      channelId: payload.channelId,
      authorId: payload.authorId,
      rawContent: content,
      url: meta.url,
      artist: meta.artist,
      title: meta.title,
      coverUrl: meta.coverUrl,
      genreRole: payload.firstRoleName,
    });
  } catch (error: unknown) {
    if (isUnknownMessageError(error)) {
      console.log(`Skipped deleted message for reaction by ${user.id}`);
      return;
    }
    console.error(
      `Failed to process memo reaction on message ${reaction.message.id}: ${(error as Error).message}`,
    );
  }
}

export default {
  name: Events.MessageReactionAdd,
  once: false,
  execute: (...args: unknown[]): Promise<void> => {
    const [reaction, user] = args as [MessageReaction, User];
    return handleMemoReaction(reaction, user);
  },
} satisfies BotEvent;
