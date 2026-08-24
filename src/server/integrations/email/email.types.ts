export interface EmailTag {
  name: string;
  value: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  tags?: EmailTag[];
}

export interface SendEmailResult {
  status: "sent" | "disabled";
  messageId?: string;
}
