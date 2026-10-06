import type { ChatInputCommandInteraction } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { data, execute } from '../../src/commands/pendientes.js';

describe('RF-04 pendientes command', () => {
  it('usa los literales exactos en español', () => {
    expect(data.toJSON()).toMatchObject({
      name: 'pendientes',
      description: 'Consulta tus discos pendientes por DM',
    });
  });

  it('execute placeholder responde de forma efímera sin lógica', async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const interaction = { reply } as unknown as ChatInputCommandInteraction;
    await execute(interaction);
    expect(reply).toHaveBeenCalledOnce();
    expect(reply).toHaveBeenCalledWith({
      content: 'Función disponible próximamente',
      ephemeral: true,
    });
  });
});
