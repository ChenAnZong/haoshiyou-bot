import { Logger, LoggerConfig } from "log4ts";
import CronJobs from '../cron-jobs';
const logger = Logger.getLogger(`login`);

exports = module.exports = async function onLogin(user) {
  logger.info(`The user ${user} logged in`);
  CronJobs.setCronJobs();
  logger.info(`Set cron jobs`);
};
