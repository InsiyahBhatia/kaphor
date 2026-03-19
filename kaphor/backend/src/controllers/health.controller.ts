import { Request, Response } from 'express';

const startTime = Date.now();

export function getHealth(_req: Request, res: Response): void {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1',
    uptime: uptimeSeconds,
  });
}
