import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './env.js';
import { registerErrorHandler } from './lib/errors.js';
import { globalRateLimit } from './lib/rate-limit.js';
import { authPlugin } from './plugins/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { ticketRoutes } from './modules/tickets/routes.js';
import { orgRoutes } from './modules/orgs/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { categoryRoutes } from './modules/categories/routes.js';
import { uploadRoutes } from './modules/uploads/routes.js';
import { statsRoutes } from './modules/stats/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    // Testlerde istek logları çıktıyı boğuyor; hata çıktısı okunamaz hale geliyordu.
    logger: env.NODE_ENV === 'test' ? false : { level: 'info' },
    // Masaüstü uygulama büyük gövde göndermiyor (dosyalar doğrudan S3'e gidiyor).
    bodyLimit: 1_000_000,
  }).withTypeProvider<ZodTypeProvider>();

  // Zod şemalarının hem doğrulama hem serileştirme için kullanılmasını sağlar.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerErrorHandler(app);

  await app.register(helmet, {
    // Swagger/Scalar arayüzü inline script kullanıyor; API'nin kendisi HTML servis etmiyor.
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      // Electron uygulaması Origin göndermez (file:// veya app://) — engellenmemeli.
      if (!origin || env.CORS_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error('CORS engellendi'), false);
    },
    credentials: true,
  });

  // Route bazlı sıkı limitler `config.rateLimit` ile ayrıca tanımlanıyor
  // (bkz. lib/rate-limit.ts).
  await app.register(rateLimit, globalRateLimit);

  await app.register(authPlugin);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'IT Destek Ticket API',
        version: '0.1.0',
        description:
          'Masaüstü müşteri uygulaması ve web yönetim paneli tarafından kullanılan API.',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(scalar, { routePrefix: '/docs' });

  app.get('/health', { schema: { hide: true } }, async () => ({ status: 'ok' }));

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(ticketRoutes, { prefix: '/tickets' });
  await app.register(orgRoutes, { prefix: '/orgs' });
  await app.register(userRoutes, { prefix: '/users' });
  await app.register(categoryRoutes, { prefix: '/categories' });
  await app.register(uploadRoutes, { prefix: '/uploads' });
  await app.register(statsRoutes, { prefix: '/stats' });

  return app;
}
