import type { Config } from '../config.js'

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log(JSON.stringify({ type: 'email', ...message }))
  }
}

export class ResendEmailProvider implements EmailProvider {
  constructor(private apiKey: string, private from: string) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        reply_to: message.replyTo,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Resend failed (${res.status}): ${body}`)
    }
  }
}

export function createEmailProvider(config: Config): EmailProvider {
  if (config.EMAIL_PROVIDER === 'resend') {
    if (!config.RESEND_API_KEY) throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend')
    return new ResendEmailProvider(config.RESEND_API_KEY, config.EMAIL_FROM)
  }
  return new ConsoleEmailProvider()
}
