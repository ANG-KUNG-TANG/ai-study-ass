import { withAuth } from "@/server/middleware/auth.middleware";

import { retryPdfIngestionController } from "@/server/controller/pdf-ingestion.controller";

export const POST = withAuth(retryPdfIngestionController);
