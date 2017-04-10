/**
 * Wechaty hot load dots demo
 *
 * DEV: docker run -ti -e --rm --volume="$(pwd)":/bot zixia/wechaty index.js
 * PROD: docker run -ti -e NODE_ENV=production --rm --volume="$(pwd)":/bot zixia/wechaty index.js
 *
 * @author: Gcaufy
 *
 */
import {watch} from "fs";
import {Logger, LoggerConfig} from "log4ts";
const Wechaty = require('wechaty').default;

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
const isProd = process.env.NODE_ENV === 'production';
const bot = Wechaty.instance();

const EVENT_LIST = [
  'scan',
  'logout',
  'login',
  'friend',
  'room-join',
  'room-leave',
  'room-topic',
  'message',
  'heartbeat',
  'error'
];


// Load listener
const loadListener = (evt) => {
  let fn;
  try {
    fn = require(`./listener/${evt}`);
    console.log(`bound listener: ${evt}`);
  } catch (e) {
    fn = () => void 0;
    if (e.toString().indexOf('Cannot find module') > -1) {
      console.warn(`listener ${evt} is not defined.`);
    } else {
      console.error(e);
    }
  }
  return fn;
};

// purge require cache
const purgeCache = (moduleName) => {
  let mod = require.resolve(moduleName);
  let modObj;
  if (mod && ((modObj = require.cache[mod]) !== undefined)) {
    (function traverse(modObj) {
      modObj.children.forEach(function (child) {
        traverse(child);
      });
      delete require.cache[modObj.id];
    }(modObj));
  }

  Object.keys(module.constructor['_pathCache']).forEach(function (cacheKey) {
    if (cacheKey.indexOf(moduleName) > 0) {
      delete module.constructor['_pathCache'][cacheKey];
    }
  });
};
configLogger();
let eventHandler = {};

if (!isProd) { // start a watcher only if it's not production environment.
  watch('./src/listener', (e, filename) => {
    let evt = filename.substring(0, filename.length - 3);
    console.log(`${e}: ${filename}`);

    if (EVENT_LIST.indexOf(evt) > -1) {
      if (e === 'change') {
        console.log(`${evt} listener reloaded.`);
        purgeCache(`./listener/${evt}`);
        // It may read an empty file, if not use setTimeout
        setTimeout(() => {
          bot.removeListener(evt, eventHandler[evt]);
          //console.log('fileContent: ' + fs.readFileSync(`./listener/${evt}.js`));
          eventHandler[evt] = loadListener(evt);
          bot.on(evt, eventHandler[evt]);
        }, 1000);
      } else if (e === 'rename') {
        console.log(`${evt} listener removed.`);
        bot.removeListener(evt, eventHandler[evt]);
        eventHandler[evt] = () => void 0;
        bot.on(evt, eventHandler[evt]);
      }
    }
  });
}

// Bind events
EVENT_LIST.forEach(evt => {
  eventHandler[evt] = loadListener(evt);
  bot.on(evt, eventHandler[evt]);
});

//noinspection JSIgnoredPromiseFromCall
bot.init();
