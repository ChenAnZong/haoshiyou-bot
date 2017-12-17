const { Wechaty } = require('wechaty'); // import { Wechaty } from 'wechaty'
import {Message, Contact, Room} from "wechaty";

Wechaty.instance() // Singleton
    .on('scan', (url:string, code:any) => console.log(`Scan QR Code to login: ${code}\n${url}`))
    .on('login',       (user:Contact) => console.log(`User ${user} logined`))
    .on('message',  (message:Message) => console.log(`Message: ${message}`))
    .start();