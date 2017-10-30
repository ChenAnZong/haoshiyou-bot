import { Logger, LoggerConfig } from "log4ts";

const logger = Logger.getLogger(`error`);

export default async function onError(error) {
  logger.trace('On Error Event!');
  logger.debug(error);
};
