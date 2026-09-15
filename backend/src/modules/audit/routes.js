const auth = require('../../middleware/auth');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().uuid().optional(),
  resourceType: z.string().trim().max(100).optional(),
  action: z.string().trim().max(100).optional(),
  search: z.string().trim().max(200).optional(),
  startDate: z
    .string()
    .trim()
    .max(40)
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), {
      message: 'startDate must be a valid date',
    }),
  endDate: z
    .string()
    .trim()
    .max(40)
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), {
      message: 'endDate must be a valid date',
    }),
});

async function routes(fastify) {
  fastify.get(
    '/',
    {
      preHandler: [auth],
      schema: {
        tags: ['Audit'],
        description: 'Get audit logs',
        querystring: toSchema(auditQuerySchema),
      },
    },
    async (req, reply) => {
      const parsed = auditQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid query parameters',
          details: parsed.error.issues,
        });
      }

      const {
        page,
        limit,
        userId,
        resourceType,
        action,
        search,
        startDate,
        endDate,
      } = parsed.data;
      const offset = (page - 1) * limit;

      const { records, total } = await repo.getAuditLogs({
        limit,
        offset,
        isAdmin: req.user.role === 'ADMIN',
        userId: req.user.role === 'ADMIN' ? userId : req.user.id,
        resourceType,
        action,
        search,
        startDate,
        endDate,
      });
      // Strip ip_address and user_agent for non-admins if the log is not their own
      const data = records.map((row) => {
        if (req.user.role !== 'ADMIN' && row.user_id !== req.user.id) {
          const { ip_address, user_agent, ...rest } = row;
          return {
            ...rest,
            ip_address: null,
            user_agent: null,
          };
        }
        return row;
      });

      return {
        data,
        total,
        page,
        limit,
      };
    }
  );
}

module.exports = routes;
