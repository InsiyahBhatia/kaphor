import { Request } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';

export interface AuditLogParams {
  userId?: string;
  action: string;
  resource?: string;
  metadata?: any;
  req?: Request;
}

/**
 * Records a sensitive action in the audit log.
 */
export async function auditLog({ userId, action, resource, metadata, req }: AuditLogParams) {
  try {
    const ip = req?.ip || req?.headers['x-forwarded-for']?.toString() || null;
    const userAgent = req?.headers['user-agent'] || null;

    await (db as any).auditLog.create({
      data: {
        userId,
        action,
        resource,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        ip,
        userAgent,
      },
    });
  } catch (error) {
    logger.error('Failed to create audit log', { error, action, userId });
  }
}
