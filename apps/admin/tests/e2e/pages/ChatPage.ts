import { type Page, expect } from '@playwright/test';
import { TID } from '../helpers/test-ids';

/**
 * Page Object for the Chat pane.
 */
export class ChatPage {
  constructor(private page: Page) {}

  async send(text: string) {
    await this.page.getByTestId(TID.chatInput).fill(text);
    await this.page.getByTestId(TID.chatSendBtn).click();
  }

  async lastMessage(): Promise<string> {
    const messages = this.page.locator('[data-testid^="chat-message-"]');
    const count = await messages.count();
    if (count === 0) return '';
    return (await messages.nth(count - 1).textContent()) ?? '';
  }
}
