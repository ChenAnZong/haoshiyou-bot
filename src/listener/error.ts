import { Logger, LoggerConfig } from "log4ts";

const logger = Logger.getLogger(`error`);

exports = module.exports = async function onError(error) {
  logger.trace('On Error Event!');
  logger.debug(error);
};
