import nodemailer from 'nodemailer';

import { env } from '../config/env.js';
import { logger } from './logger.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });
  }
  return _transporter;
}

async function send(options: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  if (env.SMTP_HOST === 'disabled') return; // allow opting out in test/CI
  try {
    await getTransporter().sendMail({
      from: env.SMTP_FROM,
      ...options,
    });
  } catch (err) {
    // Email failures are non-fatal — log and continue.
    logger.warn({ err }, 'Failed to send email');
  }
}

export async function sendBoardInvite(params: {
  toEmail: string;
  toName: string;
  boardName: string;
  inviterName: string;
  role: string;
}): Promise<void> {
  const { toEmail, toName, boardName, inviterName, role } = params;
  await send({
    to: toEmail,
    subject: `${inviterName} invited you to "${boardName}"`,
    text: [
      `Hi ${toName},`,
      '',
      `${inviterName} has added you to the CollabBoard board "${boardName}" as a ${role}.`,
      '',
      `Sign in at ${env.APP_URL} to get started.`,
      '',
      '— CollabBoard',
    ].join('\n'),
    html: `
      <p>Hi ${escapeHtml(toName)},</p>
      <p><strong>${escapeHtml(inviterName)}</strong> has added you to the CollabBoard board
      <strong>&ldquo;${escapeHtml(boardName)}&rdquo;</strong> as a <em>${escapeHtml(role)}</em>.</p>
      <p><a href="${escapeHtml(env.APP_URL)}">Sign in to CollabBoard</a> to get started.</p>
    `,
  });
}

export async function sendMentionNotification(params: {
  toEmail: string;
  toName: string;
  mentionerName: string;
  boardName: string;
  cardTitle: string;
  commentText: string;
}): Promise<void> {
  const { toEmail, toName, mentionerName, boardName, cardTitle, commentText } =
    params;
  await send({
    to: toEmail,
    subject: `${mentionerName} mentioned you on "${cardTitle}"`,
    text: [
      `Hi ${toName},`,
      '',
      `${mentionerName} mentioned you in a comment on "${cardTitle}" (${boardName}):`,
      '',
      commentText,
      '',
      '— CollabBoard',
    ].join('\n'),
    html: `
      <p>Hi ${escapeHtml(toName)},</p>
      <p><strong>${escapeHtml(mentionerName)}</strong> mentioned you in a comment on
      <strong>&ldquo;${escapeHtml(cardTitle)}&rdquo;</strong> in board
      <strong>&ldquo;${escapeHtml(boardName)}&rdquo;</strong>:</p>
      <blockquote style="border-left:3px solid #ccc;padding-left:1em;color:#555">
        ${escapeHtml(commentText)}
      </blockquote>
    `,
  });
}
