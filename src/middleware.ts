import cache from './cache';
import SignalAddon from './addons/signal';
import { Context, Messenger } from './interfaces';
import TelegramAddon from './addons/telegram';
import * as log from 'fancy-log';

/**
 * Escapes special characters for MarkdownV2, HTML, or Markdown formats.
 *
 * @param str - The string to escape.
 * @returns The escaped string.
 */
const strictEscape = (str: string, parseMode: string = cache.config.parse_mode): string => {
  switch (parseMode) {
    case 'MarkdownV2':
    case 'markdownv2':
      // Escape all special MarkdownV2 characters
      return str.replace(/([[\]()_*~`>#+\-=\|{}.!\\])/g, '\\$1');
    case 'HTML':
    case 'html':
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;'); // Escape single quotes
    case 'Markdown':
    case 'markdown':
      // Escape special Markdown characters (square brackets separately for safety)
      return str
        .replace(/([[\]_*`])/g, '\\$1')
        .replace(/(\[|\])/g, '\\$1');
    default:
      return str.toString();
  }
};

const normalizeExtra = (
  extra: any,
): { options: Record<string, unknown>; parseMode: string | null } => {
  const options = { ...(extra || {}) };
  const rawParseMode =
    typeof options.parse_mode === 'string' ? options.parse_mode : cache.config.parse_mode;
  const parseMode = typeof rawParseMode === 'string' ? rawParseMode.trim() : '';
  const lowered = parseMode.toLowerCase();

  if (!parseMode || lowered === 'none' || lowered === 'plaintext' || lowered === 'plain') {
    delete options.parse_mode;
    return { options, parseMode: null };
  }

  options.parse_mode = parseMode;
  return { options, parseMode };
};

const isTelegramEntityParseError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { message?: string; description?: string };
  const message = maybeError.message || '';
  const description = maybeError.description || '';
  return (
    message.includes("can't parse entities") ||
    description.includes("can't parse entities")
  );
};

/**
 * Sends a message through the appropriate messenger addon.
 *
 * @param id - The target identifier.
 * @param messenger - The messenger type.
 * @param msg - The message text.
 * @param extra - Extra options (default includes the configured parse mode).
 */
async function sendMessage (
  id: string | number,
  messenger: string,
  msg: string,
  extra: any = { parse_mode: cache.config.parse_mode }
): Promise<string | null> {
  const messengerType = messenger as Messenger;
  // Remove extra spaces
  const cleanedMsg = (msg ?? '').toString().replace(/ {2,}/g, ' ');
  const { options, parseMode } = normalizeExtra(extra);

  switch (messengerType) {
    case Messenger.TELEGRAM:
      try {
        return await TelegramAddon.getInstance().sendMessage(id, cleanedMsg, options);
      } catch (error) {
        if (
          parseMode &&
          parseMode.toLowerCase() === 'markdownv2' &&
          isTelegramEntityParseError(error)
        ) {
          const escapedMessage = strictEscape(cleanedMsg, 'MarkdownV2');
          if (escapedMessage !== cleanedMsg) {
            try {
              return await TelegramAddon.getInstance().sendMessage(id, escapedMessage, options);
            } catch (retryError) {
              log.error('Telegram sendMessage failed after MarkdownV2 retry:', retryError);
              return null;
            }
          }
        }
        log.error('Telegram sendMessage failed:', error);
        return null;
      }
    case Messenger.SIGNAL:
      try {
        return await SignalAddon.getInstance().sendMessage(id, cleanedMsg, options);
      } catch (error) {
        log.error('Signal sendMessage failed:', error);
        return null;
      }
    case Messenger.WEB: {
      const socketId = id.toString().split('WEB')[1];
      cache.io.to(socketId).emit('chat_staff', cleanedMsg);
      return null;
    }
    default:
      log.error(`Invalid messenger type: ${messengerType}`);
      return null;
  }
};

/**
 * Replies to a message within the given context.
 *
 * @param ctx - The message context.
 * @param msgText - The reply text.
 * @param extra - Extra options (default includes the configured parse mode).
 */
const reply = (
  ctx: Context,
  msgText: string,
  extra: any = { parse_mode: cache.config.parse_mode }
): void => {
  sendMessage(ctx.message.chat.id, ctx.messenger, msgText, extra);
};

export { strictEscape, sendMessage, reply };
