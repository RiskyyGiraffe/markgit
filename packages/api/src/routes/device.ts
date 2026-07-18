import { Hono } from 'hono';
import {
  exchangeDeviceAuthorization,
  startDeviceAuthorization,
} from '../services/device-authorization.js';

const device = new Hono();

device.post('/authorizations', async (c) => {
  const body: { clientName?: string } = await c.req
    .json<{ clientName?: string }>()
    .catch(() => ({}));
  const authorization = await startDeviceAuthorization(body.clientName);
  const webBaseUrl = (process.env.PUBLIC_WEB_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  const verificationUri = `${webBaseUrl}/cli/link`;

  return c.json({
    deviceCode: authorization.deviceCode,
    userCode: authorization.userCode,
    verificationUri,
    verificationUriComplete: `${verificationUri}?code=${encodeURIComponent(authorization.userCode)}`,
    expiresIn: Math.floor((authorization.expiresAt.getTime() - Date.now()) / 1000),
    interval: 2,
  }, 201);
});

device.post('/token', async (c) => {
  const body: { deviceCode?: string } = await c.req
    .json<{ deviceCode?: string }>()
    .catch(() => ({}));
  if (!body.deviceCode) {
    return c.json({ error: { code: 'INVALID_REQUEST', message: 'deviceCode is required' } }, 400);
  }

  const result = await exchangeDeviceAuthorization(body.deviceCode);
  switch (result.state) {
    case 'authorized':
      return c.json({
        apiKey: result.rawKey,
        keyId: result.key.id,
        keyPrefix: result.key.keyPrefix,
      });
    case 'pending':
      return c.json({ error: { code: 'AUTHORIZATION_PENDING', message: 'Waiting for approval' } }, 428);
    case 'denied':
      return c.json({ error: { code: 'ACCESS_DENIED', message: 'The authorization was denied' } }, 403);
    case 'expired':
      return c.json({ error: { code: 'EXPIRED_TOKEN', message: 'The device code has expired' } }, 400);
    case 'consumed':
      return c.json({ error: { code: 'CODE_ALREADY_USED', message: 'The device code has already been used' } }, 409);
    default:
      return c.json({ error: { code: 'INVALID_DEVICE_CODE', message: 'The device code is invalid' } }, 400);
  }
});

export { device as deviceRoutes };
