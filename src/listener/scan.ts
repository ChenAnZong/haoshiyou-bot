import {HsyBotLogger} from "../datastore";
import { Logger, LoggerConfig } from "log4ts";
const logger = Logger.getLogger(`main`);

exports = module.exports = async function onScan(url, code) {

  switch (code) {
    case 408:
      await HsyBotLogger.logDebug(`Please scan the QR code for URL ${url}. Code ${code}`);
      let loginUrl = url.replace('qrcode', 'l');
      require('qrcode-terminal').generate(loginUrl);
      break;
    case 200:
      logger.debug(`200 login confirmed`);
      break;
    case 201:
      logger.debug(`201 scanned, wait for confirm`);
      break;
    case 0:
      logger.debug(`0 init`);
      break;
    default:
      logger.debug(`Other code: ${code}`);
  }

};
