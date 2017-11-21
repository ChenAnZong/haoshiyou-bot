import { Logger, LoggerConfig } from "log4ts";
import {HsyUtil} from '../hsy-util';
const logger = Logger.getLogger(`login`);

exports = module.exports = async function onLogin(user) {
  logger.info(`The user ${user} logged in`);
  setCronJobs();
  logger.info(`Set cron jobs`);
};


function setCronJobs() {
  const ua = require('universal-analytics');
  const visitor = ua('UA-55311687-5', 'haoshiyou-bot-uuid'); // Google Analytics > haoshiyou.org > Haoshiyou-bot
  const logger = Logger.getLogger(`cronjob15000ms`);
  setInterval(async function() {
    try {
      logger.trace(`Tick 15000ms`);
      let allRentalGroups = await HsyUtil.findAllRentalHsyGroups();
      let buffer = "Group List: \n";
      for (let group of allRentalGroups) {
        buffer += `  Group ${group.topic()} Member Size ${group.memberList().length}\n`;
        visitor.event("haoshiyou-bot", `group-size`, group.topic(), group.memberList().length, function (err) {
          if (err) logger.warn(`Google Analytics failed due to ${err}`);
        });
      }
      logger.debug(buffer);


    } catch (e) {
      logger.warn(e);
    }
  }, 15000);
}

