const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const customersRouter = require('./routes/customers');
const staffRouter = require('./routes/staff');
const leadsRouter = require('./routes/leads');
const tasksRouter = require('./routes/tasks');
const organizationRouter = require('./routes/organization');
const metadataRouter = require('./routes/metadata');
const functionsRouter = require('./routes/functions');

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'crm-server' });
});

app.get('/api', (_req, res) => {
  res.json({
    message: 'CRM server API is running',
    resources: [
      'customers',
      'staff',
      'leads',
      'tasks',
      'organization',
      'metadata',
      'functions',
    ],
  });
});

app.use('/api/customers', customersRouter);
app.use('/api/staff', staffRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/organization', organizationRouter);
app.use('/api/metadata', metadataRouter);
app.use('/api/functions', functionsRouter);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error?.code === 11000) {
    return res.status(409).json({ message: 'Duplicate value detected', details: error.keyValue });
  }

  return res.status(error.status || 500).json({
    message: error.message || 'Internal server error',
  });
});

module.exports = app;
