/**
 * Message Builder
 * Fluent API for building WhatsApp messages
 */

import type { ButtonSpec, ListRowSpec, ListMessageOptions } from "../types/messages.ts";
import { LIMITS } from "../config/constants.ts";

// ============================================================================
// TEXT MESSAGE BUILDER
// ============================================================================

export class TextMessageBuilder {
  private parts: string[] = [];
  private emoji: string = "";

  /**
   * Add text content
   */
  text(content: string): this {
    this.parts.push(content);
    return this;
  }

  /**
   * Add bold text
   */
  bold(content: string): this {
    this.parts.push(`*${content}*`);
    return this;
  }

  /**
   * Add italic text
   */
  italic(content: string): this {
    this.parts.push(`_${content}_`);
    return this;
  }

  /**
   * Add line break
   */
  break(): this {
    this.parts.push("\n");
    return this;
  }

  /**
   * Add double line break
   */
  paragraph(): this {
    this.parts.push("\n\n");
    return this;
  }

  /**
   * Add bullet point
   */
  bullet(content: string): this {
    this.parts.push(`• ${content}`);
    return this;
  }

  /**
   * Add numbered item
   */
  numbered(index: number, content: string): this {
    this.parts.push(`${index}. ${content}`);
    return this;
  }

  /**
   * Add emoji prefix
   */
  withEmoji(emoji: string): this {
    this.emoji = emoji;
    return this;
  }

  /**
   * Build final message
   */
  build(): string {
    let message = this.parts.join("");
    if (this.emoji) {
      message = `${this.emoji} ${message}`;
    }
    return message.trim();
  }
}

// ============================================================================
// BUTTON MESSAGE BUILDER
// ============================================================================

export class ButtonMessageBuilder {
  private bodyText: string = "";
  private buttons: ButtonSpec[] = [];
  private headerText?: string;
  private footerText?: string;

  /**
   * Set message body
   */
  body(text: string): this {
    this.bodyText = text;
    return this;
  }

  /**
   * Set header text
   */
  header(text: string): this {
    this.headerText = text;
    return this;
  }

  /**
   * Set footer text
   */
  footer(text: string): this {
    this.footerText = text;
    return this;
  }

  /**
   * Add a button
   */
  addButton(id: string, title: string): this {
    if (this.buttons.length >= 3) {
      console.warn("WhatsApp only supports 3 buttons per message");
      return this;
    }
    
    const truncatedTitle = title.slice(0, LIMITS.WA_BUTTON_TITLE_MAX);
    this.buttons.push({ id, title: truncatedTitle });
    return this;
  }

  /**
   * Add back button
   */
  addBackButton(id: string = "back_menu", title: string = "← Back"): this {
    return this.addButton(id, title);
  }

  /**
   * Add cancel button
   */
  addCancelButton(id: string = "cancel", title: string = "Cancel"): this {
    return this.addButton(id, title);
  }

  /**
   * Build button message payload
   */
  build(): { body: string; buttons: ButtonSpec[]; header?: string; footer?: string } {
    return {
      body: this.bodyText,
      buttons: this.buttons,
      header: this.headerText,
      footer: this.footerText,
    };
  }
}

// ============================================================================
// LIST MESSAGE BUILDER
// ============================================================================

export class ListMessageBuilder {
  private titleText: string = "";
  private bodyText: string = "";
  private buttonText: string = "Open";
  private sectionTitle: string = "Options";
  private rows: ListRowSpec[] = [];

  /**
   * Set list title
   */
  title(text: string): this {
    this.titleText = text;
    return this;
  }

  /**
   * Set message body
   */
  body(text: string): this {
    this.bodyText = text;
    return this;
  }

  /**
   * Set button text
   */
  button(text: string): this {
    this.buttonText = text;
    return this;
  }

  /**
   * Set section title
   */
  section(title: string): this {
    this.sectionTitle = title;
    return this;
  }

  /**
   * Add a row
   */
  addRow(id: string, title: string, description?: string): this {
    if (this.rows.length >= LIMITS.WA_LIST_ROWS_MAX) {
      console.warn(`WhatsApp only supports ${LIMITS.WA_LIST_ROWS_MAX} rows per list`);
      return this;
    }
    
    const truncatedTitle = title.slice(0, LIMITS.WA_LIST_TITLE_MAX);
    this.rows.push({ id, title: truncatedTitle, description });
    return this;
  }

  /**
   * Add back row
   */
  addBackRow(id: string = "back_menu", title: string = "← Back", description?: string): this {
    return this.addRow(id, title, description || "Return to previous menu");
  }

  /**
   * Build list message options
   */
  build(): ListMessageOptions {
    return {
      title: this.titleText,
      body: this.bodyText,
      buttonText: this.buttonText,
      sectionTitle: this.sectionTitle,
      rows: this.rows,
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create text message builder
 */
export function text(): TextMessageBuilder {
  return new TextMessageBuilder();
}

/**
 * Create button message builder
 */
export function buttons(): ButtonMessageBuilder {
  return new ButtonMessageBuilder();
}

/**
 * Create list message builder
 */
export function list(): ListMessageBuilder {
  return new ListMessageBuilder();
}
