import { Setting } from '../models';

/** Super-admin "Made with" badge image URL stored in system settings. */
export async function getMadeWithAdvertisingImage(): Promise<string> {
  const setting = await Setting.findOne({ key: 'made_with_advertising', scope: 'system' }).lean();
  const value = (setting?.value || {}) as Record<string, unknown>;
  return typeof value.image === 'string' ? value.image : '';
}
