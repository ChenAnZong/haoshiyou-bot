import { Logger, LoggerConfig } from "log4ts";
const logger = Logger.getLogger(`main`);

exports = module.exports = async function onLogin(user) {
  logger.info(`${user} logged in`);
};
