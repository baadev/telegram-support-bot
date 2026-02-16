import { Cache, Config, Messenger } from './interfaces';
import * as YAML from 'yaml';
import * as fs from 'fs';

const cache: Cache = {
  userId: '',
  ticketIDs: [],
  ticketStatus: {},
  ticketSent: [],
  html: '',
  noSound: '',
  markdown: '',
  io: {},
  config: {
    use_llm: false
  } as Config,
};

const parseMessengerType = (messenger: unknown): Messenger | undefined => {
  if (typeof messenger !== 'string') {
    return undefined;
  }

  switch (messenger.toLowerCase()) {
    case Messenger.TELEGRAM:
    case 'tg':
      return Messenger.TELEGRAM;
    case Messenger.SIGNAL:
      return Messenger.SIGNAL;
    case Messenger.WEB:
      return Messenger.WEB;
    default:
      return undefined;
  }
};

const parsedConfig = YAML.parse(
  fs.readFileSync('./config/config.yaml', 'utf8'),
);
const mergedConfig = Object.assign(new Config(), parsedConfig) as Config;
mergedConfig.staffchat_type =
  parseMessengerType(mergedConfig.staffchat_type) ?? Messenger.TELEGRAM;
cache.config = mergedConfig;

export default cache;
