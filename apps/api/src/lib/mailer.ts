import nodemailer, { type Transporter } from 'nodemailer';
import PQueue from 'p-queue';
import { env } from '../env.js';

/**
 * Gönderim kuyruğu: SMTP yavaşlığı veya hatası HTTP isteğini bekletmemeli.
 * `concurrency: 2` çoğu SMTP sunucusunun bağlantı limitine güvenli.
 * Tek süreçte çalıştığımız için Redis tabanlı bir kuyruğa MVP'de gerek yok;
 * yeniden başlatmada kaybolan mail, düşmüş bir bildirimden ibaret.
 */
const queue = new PQueue({ concurrency: 2 });

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  heading: string;
  lines: string[];
  actionLabel?: string;
  actionUrl?: string;
}

/**
 * Fire-and-forget. Çağıran taraf beklemez — bildirim gönderilemedi diye
 * ticket oluşturma isteği başarısız olmamalı.
 */
export function sendMail(input: MailInput): void {
  const mail = getTransporter();
  if (!mail) return;

  void queue
    .add(() =>
      mail.sendMail({
        from: env.SMTP_FROM,
        to: input.to,
        subject: input.subject,
        text: toPlainText(input),
        html: toHtml(input),
      }),
    )
    .catch((err: unknown) => {
      console.error('[mailer] gönderilemedi:', err instanceof Error ? err.message : err);
    });
}

export function ticketUrl(ticketId: string): string {
  return `${env.PUBLIC_WEB_URL}/tickets/${ticketId}`;
}

function toPlainText(input: MailInput): string {
  const parts = [input.heading, '', ...input.lines];
  if (input.actionUrl) parts.push('', `${input.actionLabel ?? 'Görüntüle'}: ${input.actionUrl}`);
  return parts.join('\n');
}

function toHtml(input: MailInput): string {
  const body = input.lines.map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`).join('');
  const action = input.actionUrl
    ? `<p style="margin:24px 0 0">
         <a href="${escapeHtml(input.actionUrl)}"
            style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;
                   text-decoration:none;display:inline-block">
           ${escapeHtml(input.actionLabel ?? 'Görüntüle')}
         </a>
       </p>`
    : '';

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;
                      max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
            <h2 style="margin:0 0 16px;font-size:18px">${escapeHtml(input.heading)}</h2>
            ${body}${action}
            <hr style="margin:32px 0 12px;border:0;border-top:1px solid #e2e8f0">
            <p style="color:#64748b;font-size:12px;margin:0">
              Bu e-posta IT destek sisteminden otomatik gönderildi.
            </p>
          </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
