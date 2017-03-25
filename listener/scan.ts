import {HsyBotLogger} from "../datastore";
exports = module.exports = async function onScan(url, code) {
  await HsyBotLogger.logDebug(`Please scan the QR code for URL ${url}.`);
  let loginUrl = url.replace('qrcode', 'l');
  require('qrcode-terminal').generate(loginUrl);
};
