import { Router } from 'express';
import * as ctrl from '../controllers/public.controller';

const router = Router();

router.get('/invoices/view/:token', ctrl.getPublicInvoiceView);

export default router;
