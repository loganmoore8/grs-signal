import { randomUUID } from 'node:crypto';
import type { Mailer } from '../../services/research/alerts';
import type { Store } from '../../packages/storage/store';
export class CaptureMailer implements Mailer {
  constructor(private store: Store) {}
  async send(subject: string, text: string) {
    await this.store.snapshot(`mail/${randomUUID()}`, { subject, text, mode: 'local-only' });
  }
}
