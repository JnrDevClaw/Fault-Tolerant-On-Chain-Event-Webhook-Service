import Fastify from 'fastify';
import cors from '@fastify/cors';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { env } from './config';
import { connectDB } from './db';
import subscriptionRoutes from './routes/subscriptions';
import authRoutes from './routes/auth';
import apiKeyRoutes from './routes/apiKeys';
import { startEventListener } from './services/listener';
import { startDeliveryService } from './services/delivery';

const app = Fastify({
    logger: true,
}).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

const start = async () => {
    try {
        // Connect to Database
        await connectDB(env.MONGO_URI);

        // Register Plugins
        await app.register(cors, {
            origin: true,
        });

        // API Routes
        await app.register(subscriptionRoutes, { prefix: '/api' });
        await app.register(authRoutes);
        await app.register(apiKeyRoutes, { prefix: '/api' });

        // Health check
        app.get('/', async (request, reply) => {
            return { status: 'ok', service: 'Contract Webhook API' };
        });

        // Start background services
        startEventListener();
        startDeliveryService();

        await app.listen({ port: parseInt(env.PORT), host: '0.0.0.0' });
        console.log(`🚀 Server running on port ${env.PORT}`);

    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();

