import { describe, expect, it } from 'vitest';
import { classifyLoginError, LOGIN_ERROR_MESSAGES } from '../../src/index.js';

describe('RF-06 login error classifier', () => {
  it.each([
    [new Error('An invalid token was provided'), 'invalid-token'],
    ['TokenInvalid: An invalid token was provided', 'invalid-token'],
    [new Error('Used disallowed intents'), 'disallowed-intents'],
    [new Error('getaddrinfo ENOTFOUND discord.com'), 'network'],
    [new Error('fetch failed'), 'network'],
    [new Error('ECONNREFUSED'), 'network'],
    [new Error('something weird'), 'unknown'],
    ['plain string failure', 'unknown'],
  ])('clasifica %j como %s', (error, expected) => {
    expect(classifyLoginError(error)).toBe(expected);
  });

  it('mensaje exacto de token inválido según spec', () => {
    expect(LOGIN_ERROR_MESSAGES['invalid-token']).toBe('Discord login failed: invalid token');
  });

  it('el resto de mensajes están en español y no vacíos', () => {
    expect(LOGIN_ERROR_MESSAGES['disallowed-intents']).toMatch(/portal/i);
    expect(LOGIN_ERROR_MESSAGES.network).toMatch(/conexi/);
    expect(LOGIN_ERROR_MESSAGES.unknown.length).toBeGreaterThan(0);
  });
});
