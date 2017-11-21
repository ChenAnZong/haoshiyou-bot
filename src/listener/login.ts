import { Logger, LoggerConfig } from "log4ts";
import {HsyUtil} from '../hsy-util';
const logger = Logger.getLogger(`login`);

exports = module.exports = async function onLogin(user) {
  logger.info(`The user ${user} logged in`);
  setCronJobs();
  logger.info(`Set cron jobs`);
};


function setCronJobs() {
  const logger = Logger.getLogger(`cronjob5000ms`);
  setInterval(async function() {
    try {
      logger.trace(`Tick 5000ms`);
      let allRentalGroups = await HsyUtil.findAllRentalHsyGroups();
      let buffer = "Group List: \n";
      for (let group of allRentalGroups) {
        buffer += `  Group ${group.topic()} Member Size ${group.memberList().length}\n`;
      }
      logger.trace(buffer);
    } catch (e) {
      logger.warn(e);
    }
  }, 5000);
}

