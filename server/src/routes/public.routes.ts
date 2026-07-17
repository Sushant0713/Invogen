import { Router } from 'express';
import * as ctrl from '../controllers/public.controller';

const router = Router();

router.get('/invoices/view/:token', ctrl.getPublicInvoiceView);
router.get('/platform-invoice-render/:token', ctrl.getPlatformInvoiceRender);
router.get('/plans', ctrl.getPublicPlans);
router.get('/plan-banners', ctrl.getPublicPlanBanners);

export default router;
