import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import crypto from 'crypto';
import { ApiKey } from '../models';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

// Hash API key for storage
const hashApiKey = (key: string): string => {
    return crypto.createHash('sha256').update(key).digest('hex');
};

// Generate a new API key
const generateApiKey = (): { key: string; prefix: string } => {
    const key = `sk_live_${crypto.randomBytes(24).toString('base64url')}`;
    const prefix = key.substring(0, 15) + '...';
    return { key, prefix };
};

const apiKeyRoutes: FastifyPluginAsyncZod = async (app) => {

    // Apply auth middleware
    app.addHook('preHandler', authMiddleware);

    // POST /api-keys - Create new API key
    app.post('/api-keys', {
        schema: {
            body: z.object({
                name: z.string().min(1).max(100),
            }),
            response: {
                201: z.object({
                    _id: z.string(),
                    name: z.string(),
                    key: z.string(), // Only returned on creation!
                    prefix: z.string(),
                    createdAt: z.string().or(z.date()),
                }),
            },
        },
    }, async (request, reply) => {
        const { name } = request.body;
        const userId = (request as AuthenticatedRequest).user.id;

        const { key, prefix } = generateApiKey();
        const keyHash = hashApiKey(key);

        const apiKey = await ApiKey.create({
            userId,
            name,
            keyHash,
            prefix,
        });

        // IMPORTANT: Key is only returned ONCE at creation
        return reply.status(201).send({
            _id: apiKey.id,
            name: apiKey.name,
            key, // Full key - user must save this!
            prefix: apiKey.prefix,
            createdAt: apiKey.createdAt,
        });
    });

    // GET /api-keys - List user's API keys
    app.get('/api-keys', {
        schema: {
            response: {
                200: z.array(z.object({
                    _id: z.string(),
                    name: z.string(),
                    prefix: z.string(),
                    lastUsedAt: z.string().or(z.date()).nullable(),
                    createdAt: z.string().or(z.date()),
                })),
            },
        },
    }, async (request, reply) => {
        const userId = (request as AuthenticatedRequest).user.id;

        const keys = await ApiKey.find({ userId }).sort({ createdAt: -1 });
        return keys.map(k => ({
            _id: k.id,
            name: k.name,
            prefix: k.prefix,
            lastUsedAt: k.lastUsedAt || null,
            createdAt: k.createdAt,
        }));
    });

    // DELETE /api-keys/:id - Revoke an API key
    app.delete('/api-keys/:id', {
        schema: {
            params: z.object({ id: z.string() }),
        },
    }, async (request, reply) => {
        const userId = (request as AuthenticatedRequest).user.id;
        const { id } = request.params;

        const key = await ApiKey.findOneAndDelete({ _id: id, userId });
        if (!key) {
            return reply.status(404).send({ error: 'API key not found' });
        }

        return { message: 'API key revoked successfully' };
    });
};

export default apiKeyRoutes;
