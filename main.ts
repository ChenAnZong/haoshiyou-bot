import {Wechaty, Room} from "wechaty";

const bot = Wechaty.instance();

const hsyGreetingsMsg = '你好，谢谢你加我们群，请问你要在哪个区域（请告诉我City）找房子或者室友？' +
    '我们是按照区域分群的。我拉你入群？';
bot
    .on('scan', (url, code) => {
      let loginUrl = url.replace('qrcode', 'l');
      require('qrcode-terminal').generate(loginUrl);
      console.log(url);
    })

    .on('login', user => {
      console.log(`${user} login`);
    })

    .on('friend', async function (contact, request) {
      if (request) {  // 1. request to be friend from new contact
        request.accept();
        console.log('auto accepted for ' + contact + ' with message: ' + request.hello);
        contact.say(hsyGreetingsMsg);
      } else {        // 2. confirm friend ship
        console.log('new friend ship confirmed with ' + contact);
      }
    })

    .on('message', async function (m) {
      const contact = m.from();
      const content = m.content();
      const room = m.room();

      if (room) {
        console.log(`Room: ${room.topic()} Contact: ${contact.name()} Content: ${content}`)
      } else {
        console.log(`Contact: ${contact.name()} Content: ${content}`)
      }

      if (m.self()) {
        return; // Early return for talking to myself.
      }

      if (/hello|你好/.test(content)) {
        m.say(hsyGreetingsMsg);
      }

      if (/求加/.test(content)) {
        if (/南湾/.test(content)) {
          if (/南湾西/.test(content)) {
            m.say('好的，我这就拉你进群。');
            let keyroom = await Room.find({topic: /好室友.*南湾西/});
            if (keyroom) {
              console.log(`Adding the contact: ${contact}`);
              await keyroom.add(contact);
              console.log(`Added the contact: ${contact}`);
              await keyroom.say("欢迎新群友，", contact);
            }
          } else if (/南湾东/.test(content)) {
            m.say('好的，我这就拉你进群。');
            let keyroom = await Room.find({topic: /好室友.*南湾东/});
            if (keyroom) {
              console.log(`Adding the contact: ${contact}`);
              await keyroom.add(contact);
              console.log(`Added the contact: ${contact}`);
              await keyroom.say("欢迎新群友，", contact);
            }
          } else {
            m.say('南湾分为南湾东和南湾西，你想加哪个区域？以Santa Clara City为界。' +
                '例如Palo Alto, Mountain View, Sunnyvale, Cuptertino都属于南湾西，' +
                'San Jose, Milptas, Santa Clara都属于南湾东。');
          }
        } else if (/东湾/.test(content)) {
            m.say('好的，我这就拉你进群。');
            let keyroom = await Room.find({topic: /好室友.*东湾/});
            if (keyroom) {
              console.log(`Adding the contact: ${contact}`);
              await keyroom.add(contact);
              console.log(`Added the contact: ${contact}`);
              await keyroom.say("欢迎新群友，", contact);
            }
        } else if (/(中)半岛/.test(content)) {
          m.say('好的，我这就拉你进群。');
          let keyroom = await Room.find({topic: /好室友.*中半岛/});
          if (keyroom) {
            console.log(`Adding the contact: ${contact}`);
            await keyroom.add(contact);
            console.log(`Added the contact: ${contact}`);
            await keyroom.say("欢迎新群友，", contact);
          }
        } else if (/旧金山|三番|San Francisco/.test(content)) {
          m.say('好的，我这就拉你进群。');
          let keyroom = await Room.find({topic: /好室友.*旧金山/});
          if (keyroom) {
            console.log(`Adding the contact: ${contact}`);
            await keyroom.add(contact);
            console.log(`Added the contact: ${contact}`);
            await keyroom.say("欢迎新群友，", contact);
          }
        }

      }


      if (/testbotgroup/.test(content)) {
        console.log('Received a request to join testbotgroup');
        m.say('好的，我这就拉你进群。');
        console.log('Looking for testbotgroup');
        let keyroom = await Room.find({topic: "testbotgroup"});

        console.log('Found');
        if (keyroom) {
          console.log(`Adding the contact: ${contact}`);
          await keyroom.add(contact);
          console.log(`Added the contact: ${contact}`);
          await keyroom.say("欢迎新群友，", contact);
        }
      }

      if (/out/.test(content)) {
        let keyroom = await Room.find({topic: "test"});
        if (keyroom) {
          await keyroom.say("Remove from the room", contact);
          await keyroom.del(contact)
        }
      }
    })

    .init();

