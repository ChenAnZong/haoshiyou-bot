import { IAppender } from "log4ts/build/IAppender";
import { LogEntry } from "log4ts/build/LogEntry";
import BaseAppender from "log4ts/build/appenders/BaseAppender";
import {LogLevel} from 'log4ts/build/LogLevel';
const os = require('os');
// Imports the Google Cloud client library
const GcpSdLogging = require('@google-cloud/logging');

// Your Google Cloud Platform project ID
const projectId = 'haoshiyou-prod';

// Creates a client
const logging = new GcpSdLogging({
  projectId: projectId,

  // Ask xinbenlv@github for keyfile if you need it. It comes from Google Cloud Platform xinbenlv@gmail.com account
  // for the Service Account: default-owner@haoshiyou-prod.iam.gserviceaccount.com
  keyFilename: './.credentials/haoshiyou-prod-dc95d5f118ae.json'
});


// DEFAULT	(0) The log entry has no assigned severity level.
// DEBUG	(100) Debug or trace information.
// INFO	(200) Routine information, such as ongoing status or performance.
// NOTICE	(300) Normal but significant events, such as start up, shut down, or a configuration change.
// WARNING	(400) Warning events might cause problems.
// ERROR	(500) Error events are likely to cause problems.
// CRITICAL	(600) Critical events cause more severe problems or outages.
// ALERT	(700) A person must take an action immediately.
// EMERGENCY	(800) One or more systems are unusable.

const mapping = function (logLevel) {
  if (logLevel == LogLevel.TRACE) return 0;
  else if (logLevel == LogLevel.DEBUG) return 100;
  else if (logLevel == LogLevel.INFO) return 200;
  else if (logLevel == LogLevel.WARN) return 400;
  else if (logLevel == LogLevel.ERROR) return 500;
};

// The name of the log to write to
const logName = 'haoshiyou-bot';
// Selects the log to write to
const log = logging.log(logName);

const startTimestamp = new Date();

export default class GcpStackdriverAppender extends BaseAppender implements IAppender {
  append(entry: LogEntry): void {
    // The metadata associated with the entry
    const metadata = {
      resource: {
        type: "logging_sink",
        labels: {
          project_id: `haoshiyou-prod`,
          name: `haoshiyou-bot`
        }
      },
      timestamp: entry.time,
      severity: mapping(entry.level),
      labels: {
        hostname: `${os.hostname()}`,
        start_time: `${startTimestamp.toISOString()}`
      }
    };

    // Prepares a log entry
    const sdLogEntry = log.entry(metadata, entry.message);

    // Writes the log entry
    log.write(sdLogEntry);
  }
  clear(): void {
    throw new Error(`The method of clear is not implemented`);
  }
}
