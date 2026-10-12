import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

/**
 * Configures Redis Pub/Sub adapter for scaling Socket.io across multiple Node instances.
 * Falls back to default in-memory adapter if Redis server is unavailable.
 */
export async function setupRedisAdapter(io) {
  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST || '127.0.0.1';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const enableRedis = process.env.ENABLE_REDIS === 'true';

  if (!enableRedis && !redisUrl) {
    console.log('[Scaling] Multi-Node scaling: Defaulting to local memory adapter. (Set ENABLE_REDIS=true to activate Redis Pub/Sub)');
    return { isRedisActive: false, mode: 'in-memory' };
  }

  try {
    const pubClient = redisUrl
      ? new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 })
      : new Redis({ host: redisHost, port: redisPort, lazyConnect: true, maxRetriesPerRequest: 1 });

    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    console.log(`[Scaling] Redis Pub/Sub Adapter attached successfully! Scalable across multiple Node instances.`);
    return { isRedisActive: true, mode: 'redis-pubsub' };
  } catch (error) {
    console.warn(`[Scaling] Could not connect to Redis (${error.message}). Gracefully falling back to in-memory adapter.`);
    return { isRedisActive: false, mode: 'in-memory-fallback' };
  }
}

export default setupRedisAdapter;
