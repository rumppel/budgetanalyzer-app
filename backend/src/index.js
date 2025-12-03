import express, { json } from 'express';
import budgetsRoutes from './routes/budgets.routes.js';
import structureRoutes from './routes/budgetStructure.routes.js';
import communitiesRoutes from './routes/communities.routes.js';
import regionsRoutes from './routes/regions.routes.js';
import syncRoutes from './routes/sync.routes.js';
import statsRoutes from './routes/stats.routes.js';
import forecastRoutes from './routes/forecast.routes.js';
import authRoutes from './routes/auth.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import adminRoutes from './routes/admin.routes.js';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(json());
//app.use(morgan('dev'));
//app.use(bodyParser.json());
// app.use('/api/regions', regionsRouter);
// app.use('/api/communities', communitiesRouter);
// app.use('/api/budgets', budgetsRouter);
// app.use('/api/sync', syncRouter);
// app.use('/api/budget-structure', budgetStructureRouter);



app.use('/api/auth', authRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api', structureRoutes);          // дає /api/budget-structure/... та ін.
app.use('/api/communities', communitiesRoutes);
app.use('/api/regions', regionsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);

export default app;
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
