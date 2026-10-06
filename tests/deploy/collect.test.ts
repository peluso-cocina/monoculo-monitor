import { describe, expect, it } from 'vitest';
import { collectCommandBodies } from '../../src/deploy-commands.js';

describe('RF-01 command collection', () => {
  it('recoge los comandos válidos de src/commands como JSON', async () => {
    const bodies = await collectCommandBodies();
    expect(bodies.length).toBeGreaterThanOrEqual(1);
    expect(bodies).toContainEqual(
      expect.objectContaining({ name: 'pendientes', description: 'Consulta tus discos pendientes por DM' }),
    );
  });
});
