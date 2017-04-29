import { Logger, LoggerConfig } from "log4ts";

const logger = Logger.getLogger(`heartbeat`);

exports = module.exports = async function onHeartbeat(heartbeatObj) {
  logger.trace(`HeartBeat - ${JSON.stringify(heartbeatObj)}`);
};
