import {Message, Contact, Room} from "wechaty";
import {Logger, LoggerConfig} from "log4ts";
const PubSub = require(`@google-cloud/pubsub`);
// Imports the Google Cloud client library
const GcpSdLogging = require('@google-cloud/logging');

// Your Google Cloud Platform project ID
const projectId = 'haoshiyou-dev';
const keyFile = './.credentials/Haoshiyou-Dev-94b0d8e19b61.json';
const metadataResource = {
    type: "logging_sink",
    labels: {
      project_id: projectId,
      name: `haoshiyou-bot-v2-dev`
    }
};
// Creates a client
const logging = new GcpSdLogging({
  projectId: projectId,
  keyFilename: keyFile
});

// Instantiates a client
const pubsub = PubSub({
  projectId: projectId,
  keyFilename: keyFile
});

// The name of the log to write to
const logName = 'haoshiyou-bot';
// Selects the log to write to
const log = logging.log(logName);

function publishMessageToPubSub (topicName:string, data:object) {

  // References an existing topic, e.g. "my-topic"
  const topic = pubsub.topic(topicName);

  // Create a publisher for the topic (which can include additional batching configuration)
  const publisher = topic.publisher();

  // Publishes the message as a string, e.g. "Hello, world!" or JSON.stringify(someObject)
  const dataBuffer = Buffer.from(JSON.stringify(data));
  return publisher.publish(dataBuffer)
      .then((results:string[]) => {
        const messageId = results[0];

        console.log(`Message ${messageId} published.`);

        return messageId;
      }).catch((e:any) => {
        console.error(e);
      });
}

function sendToStackDriver(label:string, data:any) {
  // The metadata associated with the entry
  let labels:any = {};
  labels.tag = label;
  if (data.from_obj) {
    labels.from = data.from_obj.name;
  }
  if (data.to_obj) {
    labels.to = data.to_obj.name;
  }
  if (data.room_obj) {
    labels.room = data.room_obj.topic;
  }
  const metadata = {
    resource: metadataResource,
    severity: 200, // Info
    labels: labels
  };

  // Prepares a log entry
  const sdLogEntry = log.entry(metadata, data);

  // Writes the log entry
  log.write(sdLogEntry);
}

let storeWeChatyMessage = function(message:Message) {
  let logObj = JSON.parse(JSON.stringify(message.obj));
  if (message.from() != null) {
    logObj.from_obj = (message.from() as Contact).obj;
  }
  if (message.to() != null) {
    logObj.to_obj = (message.to() as Contact).obj;
  }
  if (message.room() != null) {
    let room = message.room() as Room;
    logObj.room_obj = {
      topic: room.topic(),
      memberListSize: room.memberList().length,
      id: room.id,
      senderRoomAlias: room.roomAlias(message.from())
    };
  }

  sendToStackDriver('msg-all', logObj);
  publishMessageToPubSub('msg-all', logObj);
};

const { Wechaty } = require('wechaty'); // import { Wechaty } from 'wechaty'
Wechaty.instance() // Singleton
    .on('scan', async (url:string, code:any) => {
      const logger = Logger.getLogger(`scan`);
      switch (code) {
        case 408:
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
    })
    .on('login',       (user:Contact) => console.log(`User ${user} logined`))
    .on('message',  (message:Message) => {
      console.log(message);
      storeWeChatyMessage(message);
    })
    .start();