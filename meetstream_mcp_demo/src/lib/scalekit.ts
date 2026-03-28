import ScalekitClient from '@scalekit-sdk/node';
import { config } from '../config/config.js';

let _client: ScalekitClient | null = null;

export function getScalekitClient(): ScalekitClient {
  if (!_client) {
    _client = new ScalekitClient(
      config.skEnvUrl,
      config.skClientId,
      config.skClientSecret,
    );
  }
  return _client;
}
