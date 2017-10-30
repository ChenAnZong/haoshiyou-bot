import {Logger, LoggerConfig} from "log4ts";
import {config, Wechaty, log} from 'wechaty';
/* tslint:disable:variable-name */
const finis = require('finis');

import ConsoleAppender from "log4ts/build/appenders/ConsoleAppender";
import BasicLayout from "log4ts/build/layouts/BasicLayout";
import {LogLevel} from "log4ts/build/LogLevel";

let configLogger = function() {
  let appender = new ConsoleAppender();
  let layout = new BasicLayout();
  appender.setLayout(layout);
  let config = new LoggerConfig(appender);
  config.setLevel(LogLevel.DEBUG);
  Logger.setConfig(config);
};
const bot = Wechaty.instance({profile: config.default.DEFAULT_PROFILE});

configLogger();

// Bind events
bot.on('scan', 'listener/scan');
bot.on('logout', 'listener/logout');
bot.on('login', 'listener/login');
bot.on('friend', 'listener/friend');
bot.on('room-join', 'listener/room-join');
bot.on('room-leave', 'listener/room-leave');
bot.on('room-topic', 'listener/room-topic');
bot.on('message', 'listener/message');
bot.on('heartbeat', 'listener/heartbeat');
bot.on('error', 'listener/error');

bot.init()
    .catch(async (e) => {
      log.error('Bot', 'init() fail: %s', e);
      await bot.stop();
      process.exit(-1);
    });

finis(async (code, signal) => {
  const exitMsg = `Wechaty exit ${code} because of ${signal} `;
  console.log(exitMsg);
  await bot.say(exitMsg);
});
