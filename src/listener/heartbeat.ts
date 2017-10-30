import { Logger, LoggerConfig } from "log4ts";

const logger = Logger.getLogger(`heartbeat`);

export default async function onHeartbeat(heartbeatObj) {
  logger.trace(`HeartBeat - ${JSON.stringify(heartbeatObj)}`);
};
