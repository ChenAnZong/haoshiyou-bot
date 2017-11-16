import { Logger, LoggerConfig } from "log4ts";
const logger = Logger.getLogger(`login`);

exports = module.exports = async function onLogin(user) {

  logger.info(`The user ${user} logged in`);
};
