export type WebhookProcessingStatus =
  | "received"
  | "empty_body"
  | "invalid_signature"
  | "invalid_json"
  | "ignored_event"
  | "invalid_order_id"
  | "order_fetched"
  | "auto_accepted"
  | "manual_pending"
  | "processing_error"
  | "order_cancelled_webhook_received"
  | "order_failure_webhook_received"
  | "order_release_webhook_received"
  | "store_provisioned_webhook_received"
  | "store_deprovisioned_webhook_received";

export interface WebhookDiagnosticSummary {
  status: WebhookProcessingStatus;
  eventType: string;
  eventId: string | null;
  storeId: string | null;
  orderId: string | null;
  resourceHref: string | null;
  signaturePresent: boolean;
  signatureValid: boolean | null;
  responded200: boolean;
  receivedAt: string;
  note?: string | null;
  environment?: string | null;
}

const MAX_WEBHOOK_HISTORY = 100;

let lastWebhookState: WebhookDiagnosticSummary | null = null;
const webhookHistory: WebhookDiagnosticSummary[] = [];

function cloneSummary(
  summary: WebhookDiagnosticSummary
): WebhookDiagnosticSummary {
  return JSON.parse(JSON.stringify(summary)) as WebhookDiagnosticSummary;
}

export function saveWebhookSummary(
  summary: WebhookDiagnosticSummary
): WebhookDiagnosticSummary {
  const snapshot = cloneSummary(summary);
  lastWebhookState = snapshot;
  webhookHistory.unshift(snapshot);

  if (webhookHistory.length > MAX_WEBHOOK_HISTORY) {
    webhookHistory.splice(MAX_WEBHOOK_HISTORY);
  }

  return snapshot;
}

export function getLastWebhookState(): WebhookDiagnosticSummary | null {
  return lastWebhookState ? cloneSummary(lastWebhookState) : null;
}

export function getWebhookHistory(limit = 20): WebhookDiagnosticSummary[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 20;
  return webhookHistory.slice(0, safeLimit).map(cloneSummary);
}

export function clearWebhookHistory(): {
  cleared: boolean;
  removedCount: number;
} {
  const removedCount = webhookHistory.length;
  webhookHistory.splice(0, webhookHistory.length);
  lastWebhookState = null;

  return {
    cleared: true,
    removedCount
  };
}

export function getWebhookEvidence() {
  return {
    lastWebhookState: getLastWebhookState(),
    historyCount: webhookHistory.length,
    recentHistory: getWebhookHistory(10)
  };
}