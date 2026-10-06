import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type ActionRowBuilder as ActionRowBuilderType,
} from 'discord.js';
import {
  buildGroupedFields,
  buildSelectOptions,
  formatPageTitle,
  makeMarkId,
  makePageId,
  paginateGrouped,
} from '../services/backlogView.js';
import type { PendingItem } from '../types/index.js';

export const MARK_PLACEHOLDER = 'Marca como escuchados…';
export const ALL_DONE_MESSAGE = 'Sin pendientes: lista al día. 🎉';
export const EMBED_COLOR = 0x5865f2;

export interface BacklogMessage {
  embeds: [EmbedBuilder];
  components: ActionRowBuilderType<ButtonBuilder | StringSelectMenuBuilder>[];
}

export function buildBacklogMessage(items: PendingItem[], userId: string, page: number): BacklogMessage {
  const { pageItems, page: safePage, totalPages, startNumber } = paginateGrouped(items, page);
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(formatPageTitle(safePage, totalPages))
    .addFields(buildGroupedFields(pageItems, startNumber));
  const firstCover = pageItems.find((item) => item.coverUrl !== null)?.coverUrl;
  if (firstCover !== undefined) embed.setImage(firstCover);

  const options = buildSelectOptions(pageItems);
  const select = new StringSelectMenuBuilder()
    .setCustomId(makeMarkId(userId, safePage))
    .setPlaceholder(MARK_PLACEHOLDER)
    .setMinValues(1)
    .setMaxValues(Math.max(1, options.length))
    .addOptions(
      options.map((option) =>
        option.description === undefined
          ? { label: option.label, value: option.value }
          : { label: option.label, value: option.value, description: option.description },
      ),
    );
  const components: BacklogMessage['components'] = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
  ];

  if (totalPages > 1) {
    const prev = new ButtonBuilder()
      .setCustomId(makePageId(userId, safePage - 1))
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage === 0);
    const next = new ButtonBuilder()
      .setCustomId(makePageId(userId, safePage + 1))
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage === totalPages - 1);
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next));
  }

  return { embeds: [embed], components };
}
