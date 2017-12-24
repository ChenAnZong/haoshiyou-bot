import {Message, Contact, Room, MsgType, MediaMessage} from "wechaty";
import {Logger, LoggerConfig} from "log4ts";
const PubSub = require(`@google-cloud/pubsub`);
const GcpSdLogging = require('@google-cloud/logging');
const cloudinary = require('cloudinary');
const { Wechaty } = require('wechaty'); // import { Wechaty } from 'wechaty'
const fs = require('fs');

// Your Google Cloud Platform project ID
const projectId = 'haoshiyou-dev';
const credentialFolder = '.credentials/';
const gcpCredentialPath = credentialFolder + 'Haoshiyou-Dev-94b0d8e19b61.json';
const cloudinaryCredentialPath = credentialFolder + 'cloudinary.json';
let checkCredExits = function () {
  console.assert(fs.existsSync(gcpCredentialPath),
      `The GCP credentials doesn't exist, 
      please contact xinbenlv@ and download put in path ${gcpCredentialPath}`);
  console.assert(fs.existsSync(cloudinaryCredentialPath),
      `The Cloudinary credentials doesn't exist, 
      please contact xinbenlv@ and download put in path ${cloudinaryCredentialPath}`);
};

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
  keyFilename: gcpCredentialPath
});

// Instantiates a client
const pubsub = PubSub({
  projectId: projectId,
  keyFilename: gcpCredentialPath
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

let configCloudinary = function() {
  const fs = require(`fs`);
  const credential = JSON.parse(String(fs.readFileSync(cloudinaryCredentialPath)));
  cloudinary.config(credential);
};

let storeWeChatyMessage = async function(message:Message) {
  let logObj = JSON.parse(JSON.stringify(message.obj));
  if (message.type() == MsgType.IMAGE) {
    let mediaMessage = <MediaMessage>message;
    console.log(`Received an image!`);
    let mediaStream = await mediaMessage.readyStream();
    const promise = new Promise((resolve, reject) => {
    mediaStream.pipe(cloudinary.v2.uploader.upload_stream(
          function(error, result){
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
      ));
    });
    let cloudinaryResult:object = await promise;
    console.log(cloudinaryResult);
    logObj['image'] = {
      vendor: 'cloudinary',
      public_id: cloudinaryResult['public_id'],
      etag: cloudinaryResult['etag']
    }
  }
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
  await publishMessageToPubSub('msg-all', logObj);
};

let shouldCareAboutMessage = function(message:Message):boolean {
  return (!message.room() ||
      /好室友/.test(message.room().topic())) ||
      /租|房|屋|室|招|rent|lease/i.test(message.content());
};

// -------------------------

checkCredExits();
configCloudinary();

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
    .on('message',  async (message:Message) => {
      // console.log(message);
      if (shouldCareAboutMessage(message)){
        console.log(`storing ${message}`);
        await storeWeChatyMessage(message);
      } else {
        // ignore
        console.log(`Ignored ${message}`);
      }
    })
    .start();