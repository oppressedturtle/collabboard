import swaggerJsdoc from 'swagger-jsdoc';

const objectIdSchema = {
  type: 'string',
  pattern: '^[a-f\\d]{24}$',
  example: '64b1f2c3d4e5f6a7b8c9d0e1',
};

const spec: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'CollabBoard API',
      version: '0.1.0',
      description:
        'REST API for CollabBoard — a real-time collaborative Kanban board. ' +
        'Authentication uses httpOnly cookies set on login/register. ' +
        'All protected routes require a valid access_token cookie.',
    },
    servers: [{ url: 'http://localhost:4000', description: 'Local development' }],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' },
      },
      schemas: {
        ObjectId: objectIdSchema,
        User: {
          type: 'object',
          properties: {
            id: objectIdSchema,
            email: { type: 'string', format: 'email', example: 'alice@example.com' },
            name: { type: 'string', example: 'Alice' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'email', 'name'],
        },
        Member: {
          type: 'object',
          properties: {
            user: objectIdSchema,
            role: { type: 'string', enum: ['owner', 'editor', 'viewer'] },
          },
          required: ['user', 'role'],
        },
        Board: {
          type: 'object',
          properties: {
            id: objectIdSchema,
            name: { type: 'string', maxLength: 120, example: 'My Project' },
            description: { type: 'string', maxLength: 2000 },
            owner: objectIdSchema,
            members: { type: 'array', items: { $ref: '#/components/schemas/Member' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'owner', 'members'],
        },
        List: {
          type: 'object',
          properties: {
            id: objectIdSchema,
            board: objectIdSchema,
            title: { type: 'string', maxLength: 120, example: 'To Do' },
            position: { type: 'integer', minimum: 0 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'board', 'title', 'position'],
        },
        Card: {
          type: 'object',
          properties: {
            id: objectIdSchema,
            board: objectIdSchema,
            list: objectIdSchema,
            title: { type: 'string', maxLength: 280, example: 'Fix login bug' },
            description: { type: 'string', maxLength: 5000 },
            labels: { type: 'array', items: { type: 'string' }, example: ['bug', 'frontend'] },
            assignees: { type: 'array', items: objectIdSchema },
            dueDate: { type: 'string', format: 'date-time', nullable: true },
            position: { type: 'integer', minimum: 0 },
            version: { type: 'integer', minimum: 0 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'board', 'list', 'title', 'position', 'version'],
        },
        Comment: {
          type: 'object',
          properties: {
            id: objectIdSchema,
            board: objectIdSchema,
            card: objectIdSchema,
            author: {
              oneOf: [
                objectIdSchema,
                {
                  type: 'object',
                  properties: {
                    id: objectIdSchema,
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                  },
                },
              ],
            },
            text: { type: 'string', maxLength: 2000, example: 'LGTM! @bob@example.com can you review?' },
            mentions: { type: 'array', items: objectIdSchema },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'board', 'card', 'author', 'text'],
        },
        Error: {
          type: 'object',
          properties: { error: { type: 'string', example: 'Resource not found' } },
          required: ['error'],
        },
        OkResponse: {
          type: 'object',
          properties: { ok: { type: 'boolean', example: true } },
          required: ['ok'],
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing or invalid auth cookie',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: 'Insufficient board role',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        BadRequest: {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
    tags: [
      { name: 'auth', description: 'Registration, login, and session management' },
      { name: 'boards', description: 'Board CRUD and member management' },
      { name: 'lists', description: 'List (column) CRUD within a board' },
      { name: 'cards', description: 'Card CRUD and move operations' },
      { name: 'comments', description: 'Comments on cards with @mention support' },
      { name: 'health', description: 'Liveness and readiness probes' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['health'], summary: 'Liveness probe', operationId: 'getHealth',
          responses: {
            '200': {
              description: 'Process is alive',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      uptime: { type: 'integer' },
                      timestamp: { type: 'string', format: 'date-time' },
                      version: { type: 'string' },
                      db: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/health/ready': {
        get: {
          tags: ['health'], summary: 'Readiness probe', operationId: 'getHealthReady',
          responses: {
            '200': { description: 'Service ready' },
            '503': { description: 'Database not connected' },
          },
        },
      },
      '/auth/register': {
        post: {
          tags: ['auth'], summary: 'Register a new account', operationId: 'register',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object', required: ['email', 'password', 'name'],
                  properties: {
                    email: { type: 'string', format: 'email', maxLength: 254 },
                    password: { type: 'string', minLength: 8, maxLength: 128 },
                    name: { type: 'string', minLength: 1, maxLength: 80 },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Account created; auth cookies set',
              content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '409': { description: 'Email already registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['auth'], summary: 'Log in', operationId: 'login',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object', required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 1 },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Logged in; auth cookies set',
              content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['auth'], summary: 'Rotate tokens', operationId: 'refreshTokens',
          responses: {
            '200': { description: 'Tokens rotated', content: { 'application/json': { schema: { $ref: '#/components/schemas/OkResponse' } } } },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['auth'], summary: 'Log out', operationId: 'logout',
          responses: {
            '200': { description: 'Logged out; cookies cleared', content: { 'application/json': { schema: { $ref: '#/components/schemas/OkResponse' } } } },
          },
        },
      },
      '/auth/me': {
        get: {
          tags: ['auth'], summary: 'Get current user', operationId: 'getMe',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': {
              description: 'Authenticated user',
              content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/boards': {
        get: {
          tags: ['boards'], summary: 'List my boards', operationId: 'listBoards',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': {
              description: 'Array of boards',
              content: { 'application/json': { schema: { type: 'object', properties: { boards: { type: 'array', items: { $ref: '#/components/schemas/Board' } } } } } },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
        post: {
          tags: ['boards'], summary: 'Create a board', operationId: 'createBoard',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object', required: ['name'],
                  properties: {
                    name: { type: 'string', minLength: 1, maxLength: 120 },
                    description: { type: 'string', maxLength: 2000 },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Board created',
              content: { 'application/json': { schema: { type: 'object', properties: { board: { $ref: '#/components/schemas/Board' } } } } },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/boards/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: objectIdSchema }],
        get: {
          tags: ['boards'], summary: 'Get a board', operationId: 'getBoard',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': { description: 'Board', content: { 'application/json': { schema: { type: 'object', properties: { board: { $ref: '#/components/schemas/Board' } } } } } },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        patch: {
          tags: ['boards'], summary: 'Update a board', operationId: 'updateBoard',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object', minProperties: 1,
                  properties: { name: { type: 'string', minLength: 1, maxLength: 120 }, description: { type: 'string', maxLength: 2000 } },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Updated board', content: { 'application/json': { schema: { type: 'object', properties: { board: { $ref: '#/components/schemas/Board' } } } } } },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['boards'], summary: 'Delete a board', operationId: 'deleteBoard',
          security: [{ cookieAuth: [] }],
          responses: {
            '204': { description: 'Board deleted' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/boards/{id}/members': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: objectIdSchema }],
        post: {
          tags: ['boards'], summary: 'Add a member', operationId: 'addMember',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object', required: ['email'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    role: { type: 'string', enum: ['editor', 'viewer'], default: 'viewer' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Member added', content: { 'application/json': { schema: { type: 'object', properties: { board: { $ref: '#/components/schemas/Board' } } } } } },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { description: 'User already a member', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/boards/{id}/members/{userId}': {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: objectIdSchema },
          { name: 'userId', in: 'path', required: true, schema: objectIdSchema },
        ],
        patch: {
          tags: ['boards'], summary: 'Update member role', operationId: 'updateMemberRole',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['editor', 'viewer'] } } } } },
          },
          responses: {
            '200': { description: 'Role updated', content: { 'application/json': { schema: { type: 'object', properties: { board: { $ref: '#/components/schemas/Board' } } } } } },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['boards'], summary: 'Remove a member', operationId: 'removeMember',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': { description: 'Member removed', content: { 'application/json': { schema: { type: 'object', properties: { board: { $ref: '#/components/schemas/Board' } } } } } },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/boards/{id}/lists': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: objectIdSchema }],
        get: {
          tags: ['lists'], summary: 'List columns', operationId: 'listLists',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': { description: 'Array of lists', content: { 'application/json': { schema: { type: 'object', properties: { lists: { type: 'array', items: { $ref: '#/components/schemas/List' } } } } } } },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        post: {
          tags: ['lists'], summary: 'Create a column', operationId: 'createList',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['title'], properties: { title: { type: 'string', minLength: 1, maxLength: 120 } } } } },
          },
          responses: {
            '201': { description: 'List created', content: { 'application/json': { schema: { type: 'object', properties: { list: { $ref: '#/components/schemas/List' } } } } } },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/boards/{id}/lists/{listId}': {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: objectIdSchema },
          { name: 'listId', in: 'path', required: true, schema: objectIdSchema },
        ],
        patch: {
          tags: ['lists'], summary: 'Update a column', operationId: 'updateList',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', minProperties: 1, properties: { title: { type: 'string', minLength: 1, maxLength: 120 }, position: { type: 'integer', minimum: 0 } } } } },
          },
          responses: {
            '200': { description: 'Updated list', content: { 'application/json': { schema: { type: 'object', properties: { list: { $ref: '#/components/schemas/List' } } } } } },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['lists'], summary: 'Delete a column', operationId: 'deleteList',
          security: [{ cookieAuth: [] }],
          responses: {
            '204': { description: 'List deleted' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/boards/{id}/cards': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: objectIdSchema }],
        get: {
          tags: ['cards'], summary: 'List cards', operationId: 'listCards',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': { description: 'Array of cards', content: { 'application/json': { schema: { type: 'object', properties: { cards: { type: 'array', items: { $ref: '#/components/schemas/Card' } } } } } } },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        post: {
          tags: ['cards'], summary: 'Create a card', operationId: 'createCard',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object', required: ['listId', 'title'],
                  properties: {
                    listId: { ...objectIdSchema, description: 'Target list ID' },
                    title: { type: 'string', minLength: 1, maxLength: 280 },
                    description: { type: 'string', maxLength: 5000 },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Card created', content: { 'application/json': { schema: { type: 'object', properties: { card: { $ref: '#/components/schemas/Card' } } } } } },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/boards/{id}/cards/{cardId}': {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: objectIdSchema },
          { name: 'cardId', in: 'path', required: true, schema: objectIdSchema },
        ],
        get: {
          tags: ['cards'], summary: 'Get a card', operationId: 'getCard',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': { description: 'Card', content: { 'application/json': { schema: { type: 'object', properties: { card: { $ref: '#/components/schemas/Card' } } } } } },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        patch: {
          tags: ['cards'], summary: 'Update a card', operationId: 'updateCard',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object', minProperties: 1,
                  properties: {
                    title: { type: 'string', minLength: 1, maxLength: 280 },
                    description: { type: 'string', maxLength: 5000 },
                    labels: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 40 }, maxItems: 20 },
                    assignees: { type: 'array', items: objectIdSchema, maxItems: 50 },
                    dueDate: { type: 'string', format: 'date-time', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Updated card', content: { 'application/json': { schema: { type: 'object', properties: { card: { $ref: '#/components/schemas/Card' } } } } } },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['cards'], summary: 'Delete a card', operationId: 'deleteCard',
          security: [{ cookieAuth: [] }],
          responses: {
            '204': { description: 'Card deleted' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/boards/{id}/cards/{cardId}/move': {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: objectIdSchema },
          { name: 'cardId', in: 'path', required: true, schema: objectIdSchema },
        ],
        patch: {
          tags: ['cards'], summary: 'Move a card', operationId: 'moveCard',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object', required: ['listId', 'position'],
                  properties: {
                    listId: { ...objectIdSchema, description: 'Target list ID' },
                    position: { type: 'integer', minimum: 0 },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Card in new position', content: { 'application/json': { schema: { type: 'object', properties: { card: { $ref: '#/components/schemas/Card' } } } } } },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/boards/{id}/cards/{cardId}/comments': {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: objectIdSchema },
          { name: 'cardId', in: 'path', required: true, schema: objectIdSchema },
        ],
        get: {
          tags: ['comments'], summary: 'List comments', operationId: 'listComments',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': { description: 'Array of comments', content: { 'application/json': { schema: { type: 'object', properties: { comments: { type: 'array', items: { $ref: '#/components/schemas/Comment' } } } } } } },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        post: {
          tags: ['comments'], summary: 'Post a comment', operationId: 'createComment',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string', minLength: 1, maxLength: 2000 } } } } },
          },
          responses: {
            '201': { description: 'Comment created', content: { 'application/json': { schema: { type: 'object', properties: { comment: { $ref: '#/components/schemas/Comment' } } } } } },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/boards/{id}/cards/{cardId}/comments/{commentId}': {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: objectIdSchema },
          { name: 'cardId', in: 'path', required: true, schema: objectIdSchema },
          { name: 'commentId', in: 'path', required: true, schema: objectIdSchema },
        ],
        delete: {
          tags: ['comments'], summary: 'Delete a comment', operationId: 'deleteComment',
          security: [{ cookieAuth: [] }],
          responses: {
            '204': { description: 'Comment deleted' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
    },
  },
  apis: [],
};

export const openApiSpec = swaggerJsdoc(spec);
