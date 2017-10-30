import { Logger, LoggerConfig } from "log4ts";
const logger = Logger.getLogger(`main`);

export default async function onLogin(user) {
  logger.info(`${user} logged in`);
};
