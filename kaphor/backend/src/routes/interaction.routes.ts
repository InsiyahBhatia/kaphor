import { Router } from 'express';
import { body } from 'express-validator';
import { validateRequeset } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { createInteraction } from '../controllers/interaction.controller';

export const interactionRouter = Router();

interactionRouter.post('/',
    authenticate,
    [
        body('garmentId').isUUID(),
        body('eventType').isString().notEmpty(),
        body('metadata').optional().isObject(),
    ],
    validateRequeset,
    createInteraction
);
