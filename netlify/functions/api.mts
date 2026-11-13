import type { Config, Context } from '@netlify/functions';
import { handleApiRequest } from '../../server/app.ts';
import { productionDeps } from '../../server/production.ts';

export default async (request: Request, context: Context): Promise<Response> =>
  handleApiRequest(request, () => productionDeps(), { clientIp: context.ip ?? null });

export const config: Config = {
  path: '/api/*',
};
