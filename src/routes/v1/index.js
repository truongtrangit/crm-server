const { Router } = require('express');

const authRouter = require('./auth.routes');
const customersRouter = require('./customers.routes');
const usersRouter = require('./users.routes');

const eventsRouter = require('./events.routes');
const organizationRouter = require('./organization.routes');
const metadataRouter = require('./metadata.routes');
const functionsRouter = require('./functions.routes');
const functionalGroupsRouter = require('./functionalGroups.routes');
const rbacRouter = require('./rbac.routes');
const actionConfigRouter = require('./actionConfig.routes');
const eventChainsRouter = require('./eventChains.routes');
const globalEventChainsRouter = require('./globalEventChains.routes');
const webhooksRouter = require('./webhooks.routes');
const logsRouter = require('./logs.routes');
const metaRouter = require('./meta.routes');
const leadConfigRouter = require('./leadConfig.routes');
const leadRouter = require('./leads.routes');
const taskRouter = require('./tasks.routes');
const taskChainsRouter = require('./taskChains.routes');
const funnelsRouter = require('./funnels.routes');
const staffRouter = require('./staffs.routes');
const salaryRouter = require('./salaries.routes');
const salaryConfigRouter = require('./salaryConfigs.routes');
const revenueRouter = require('./revenues.routes');
const expenseRouter = require('./expenses.routes');
const companiesRouter = require('./companies.routes');
const financeRouter = require('./finance.routes');
const policyRouter = require('./policy.routes');
const jobConfigRouter = require('./jobConfig.routes');
const jobWorkRouter = require('./jobWork.routes');
const courseConfigRouter = require('./courseConfigs.routes');
const courseLecturersRouter = require('./courseLecturers.routes');
const coursesOnlineRouter = require('./coursesOnline.routes');
const coursesOfflineRouter = require('./coursesOffline.routes');
const courseEnrollmentsRouter = require('./courseEnrollments.routes');
const courseVouchersRouter = require('./courseVouchers.routes');
const courseChallengesRouter = require('./courseChallenges.routes');
const coursesKnowledgeRouter = require('./knowledge.routes');
const courseSubmissionsRouter = require('./courseSubmissions.routes');
const courseCreditsRouter = require('./courseCredits.routes');
const courseFavoritesRouter = require('./courseFavorites.routes');
const orderWebhooksRouter = require('./orderWebhooks.routes');
const zcodesRouter = require('./zcodes.routes');
const bankLogsRouter = require('./bankLogs.routes');
const invoicesRouter = require('./invoices.routes');
const eventGroupsRouter = require('./eventGroups.routes');
const integrationConfigsRouter = require('./integrationConfigs.routes');
const integrationLogsRouter = require('./integrationLog.routes');

const { authenticateRequest } = require('../../core/middleware/auth');
const { sendSuccess } = require('../../core/utils/http');

const v1Router = Router();

// ─── Public ──────────────────────────────────────────────────────────────────
v1Router.get('/', (_req, res) =>
  sendSuccess(res, 200, 'CRM API v1 is running', {
    version: 'v1',
    resources: [
      'auth',
      'customers',
      'users',
      'events',
      'event-chains',
      'leads',
      'lead-config',
      'tasks',
      'funnels',
      'meta',
      'staffs',
      'salaries',
      'salary-configs',
      'revenues',
      'expenses',
      'finance',
      'policy',
      'companies',
      'job-hub',
      'courses',
      'zcodes',
      'bank-logs',
      'invoices',
      'event-groups',
      'integration-configs',
      'organization',
      'metadata',
      'functions',
      'functional-groups',
      'rbac',
      'action-config',
      'webhooks',
      'logs',
    ],
  }),
);

v1Router.use('/auth', authRouter);

// ─── Webhook ingestion (own auth — bearer token, not CRM session) ───────────
v1Router.use('/webhooks', webhooksRouter);

// ─── Public Integration Webhook ─────────────────────────────────────────────
const integrationWebhookRouter = require('./integrationWebhook.routes');
v1Router.use('/integration-webhook', integrationWebhookRouter);

// ─── Protected ───────────────────────────────────────────────────────────────
v1Router.use(authenticateRequest);

// ─── Module APIs (RBAC applied in individual routers) ────────────────────────
v1Router.use('/customers', customersRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/events', eventsRouter);
v1Router.use('/meta', metaRouter);
v1Router.use('/lead-config', leadConfigRouter);
v1Router.use('/leads', leadRouter);
v1Router.use('/tasks', taskRouter);
v1Router.use('/logs', logsRouter);

// --- IMPORTANT
v1Router.use('/staffs', staffRouter);
v1Router.use('/salaries', salaryRouter);
v1Router.use('/salary-configs', salaryConfigRouter);
v1Router.use('/revenues', revenueRouter);
v1Router.use('/expenses', expenseRouter);
v1Router.use('/finance', financeRouter);
v1Router.use('/policy', policyRouter);
// --- IMPORTANT

v1Router.use('/companies', companiesRouter);
v1Router.use('/job-hub/configs', jobConfigRouter);
v1Router.use('/job-hub/work', jobWorkRouter);
v1Router.use('/courses/configs', courseConfigRouter);
v1Router.use('/courses/lecturers', courseLecturersRouter);
v1Router.use('/courses/online', coursesOnlineRouter);
v1Router.use('/courses/offline', coursesOfflineRouter);
v1Router.use('/courses/enrollments', courseEnrollmentsRouter);
v1Router.use('/courses/vouchers', courseVouchersRouter);
v1Router.use('/courses/challenges', courseChallengesRouter);
v1Router.use('/courses/knowledge', coursesKnowledgeRouter);
v1Router.use('/courses/submissions', courseSubmissionsRouter);
v1Router.use('/courses/credits', courseCreditsRouter);
v1Router.use('/courses/favorites', courseFavoritesRouter);
v1Router.use('/courses/order-webhooks', orderWebhooksRouter);
v1Router.use('/zcodes', zcodesRouter);
v1Router.use('/bank-logs', bankLogsRouter);
v1Router.use('/invoices', invoicesRouter);
v1Router.use('/event-groups', eventGroupsRouter);
v1Router.use('/integration-configs', integrationConfigsRouter);
v1Router.use('/integration-logs', integrationLogsRouter);

// ─── Shared / Lookup APIs — no MLAC, only auth login required ───────────────
v1Router.use('/organization', organizationRouter);
v1Router.use('/metadata', metadataRouter);
v1Router.use('/functions', functionsRouter);
v1Router.use('/functional-groups', functionalGroupsRouter);
v1Router.use('/rbac', rbacRouter);
v1Router.use('/action-config', actionConfigRouter);
v1Router.use('/funnels', funnelsRouter);
v1Router.use('/event-chains', globalEventChainsRouter);

// Nested: chuỗi hành động trong sự kiện
v1Router.use('/events/:eventId/chains', eventChainsRouter);

// Nested: chuỗi hành động trong tác vụ
v1Router.use('/tasks/:taskId/chains', taskChainsRouter);

module.exports = v1Router;
