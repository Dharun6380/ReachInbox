import { Router } from 'express';
import { createCampaign, getCampaigns, getJobs, getDashboardStats } from '../controllers/campaign.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken as any);

router.post('/', createCampaign as any);
router.get('/', getCampaigns as any);
router.get('/jobs', getJobs as any);
router.get('/stats', getDashboardStats as any);

export default router;
