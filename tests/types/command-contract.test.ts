import { SlashCommandBuilder } from 'discord.js';
import { describe, expect, it } from 'vitest';
import type { BotCommand, DeployScope } from '../../src/types/index.js';

describe('U1 command/deploy contracts', () => {
  it('BotCommand acepta un SlashCommandBuilder real y un execute', () => {
    const command: BotCommand = {
      data: new SlashCommandBuilder().setName('x').setDescription('y'),
      execute: () => Promise.resolve(),
    };
    expect(command.data.toJSON()).toMatchObject({ name: 'x', description: 'y' });
    expect(typeof command.execute).toBe('function');
  });

  it('DeployScope distingue guild y global', () => {
    const guild: DeployScope = { kind: 'guild', guildId: '123' };
    const global: DeployScope = { kind: 'global' };
    expect(guild.kind).toBe('guild');
    expect(global.kind).toBe('global');
  });
});
