import { adminService } from '../services/admin.service';
import { subscriptionService } from '../services/subscription.service';
import { getPlatformInvoiceRenderPayload } from '../utils/platform-invoice-render-store';
import { AppError } from '../utils/AppError';
import { wrap, param } from '../utils/controller';

export const getPublicInvoiceView = wrap((req) =>
  adminService.getPublicInvoiceByToken(param(req.params.token))
);

export const getPlatformInvoiceRender = wrap(async (req) => {
  const payload = getPlatformInvoiceRenderPayload(param(req.params.token));
  if (!payload) {
    throw new AppError('Render session expired or not found', 404);
  }
  return {
    pages: payload.pages,
    invoiceNumber: payload.invoiceNumber,
    branding: payload.branding,
    tax: payload.tax,
  };
});

/** Public marketing / pricing catalog (plans marked visibleOnWebsite). */
export const getPublicPlans = wrap(() => subscriptionService.getAvailablePlans());
