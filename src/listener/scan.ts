import {HsyBotLogger} from "../datastore";
import { Logger, LoggerConfig } from "log4ts";
const logger = Logger.getLogger(`scan`);

exports = module.exports = async function onScan(url, code) {
  switch (code) {
    case 408:
      await HsyBotLogger.logDebug(`Please scan the QR code for URL ${url}. Code ${code}`);
      let loginUrl = url.replace('qrcode', 'l');
      require('qrcode-terminal').generate(loginUrl);
      break;
    case 200:
      logger.debug(`WeChaty Scan 200 login confirmed`);
      break;
    case 201:
      logger.debug(`WeChaty Scan 201 scanned, wait for confirm`);
      break;
    case 0:
      logger.debug(`WeChaty Scan 0 init`);
      break;
    default:
      logger.debug(`WeChaty Scan Other code: ${code}`);
  }

};
