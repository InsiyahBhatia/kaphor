import { Router } from 'express';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { createInteractionSchema } from '../schemas';
import { createInteraction } from '../controllers/interaction.controller';

export const interactionRouter = Router();

interactionRouter.post('/',
    authenticate,
    validate({ body: createInteractionSchema }),
    createInteraction
);
