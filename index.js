const config = require('./config')
const superagent = require('superagent');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

var MongoClient = require('mongodb').MongoClient
var mongodb;

const mongo_uri = process.env.MONGODB_URI || config.mongo_uri
MongoClient.connect(mongo_uri, function (err, db) {
	if (err) throw err

	mongodb = db;
})

const options = {
	webHook: {
		port: process.env.PORT || config.port
	}
}

const telegram_api_key = process.env.TELEGRAM_API_KEY
const bot = new TelegramBot(telegram_api_key, options)

const commands = {
	async start(msg, params) {
		const url = config.booked.url + 'Authentication/Autheticate'
		console.log(url)
		try {
			bot.sendMessage(msg.chat.id, 'I\'m looking this up for you. Please wait a second.')
			const res = await superagent.post(url).send({code: params})
			mongodb.collection('connections').update(
				{ chat_id: msg.from.id },
				{ chat_id: msg.from.id, access_token: res.body.access_token },
				{
					upsert: true,
				},
			);
			bot.sendMessage(msg.chat.id, 'Great! You have been successfully signed up to my booking services. Feel free to ask me about available rooms to /book.')
		} catch (error) {
			bot.sendMessage(msg.chat.id, 'Please tell me your charite.de email address to /signup for my booking services.')
		}
	},

	async signup(msg, params) {
		const url = config.booked.url + 'Telegram/signup'
		try {
			bot.sendMessage(msg.chat.id, 'I\'m signing you up. Please wait a second...')

			const res = await superagent.post(url).send({email: params})
			bot.sendMessage(msg.chat.id, 'Ok. I have sent you an email with further instruction on how to validate your account. Please check your email inbox.')
		} catch (error) {
			bot.sendMessage(msg.chat.id, 'Please send me a valid charite.de email address with this command.')
		}
	},

	async bookings(msg, params) {
		let user = mongodb.collection('connections').findOne({ chat_id: msg.from.id });
		if(!user) {
			bot.sendMessage(msg.chat.id, 'You have to be signed up to use my services. Please use /signup _your.email.address@charite.de_ to sign up with your email.', {parse_mode: 'Markdown'})
			return
		}
		const url = config.booked.url + 'Resources/Status'
		try {
			bot.sendMessage(msg.chat.id, 'I\'m looking this you up. Please wait a second...')

			const res = await superagent.get(url)
			bot.sendMessage(msg.chat.id, JSON.stringify(res.body))
		} catch (error) {
			bot.sendMessage(msg.chat.id, 'Something went wrong.. ' + error)
		}
	}
}

function processCommand(msg, entity) {
	let cmd = msg.text.substr(entity.offset + 1, entity.length - 1)
	let params = msg.text.substr(entity.offset + entity.length + 1);
	if(commands[cmd]) {
		commands[cmd](msg, params)
	}
}

bot.on('text', function onMessage(msg) {
	if(msg.entities) {
		msg.entities
			.filter((entity) => entity.type === 'bot_command')
			.map((entity) => processCommand(msg, entity))
	}
});

bot.on('webhook_error', (error) => {
	//bot.sendMessage(msg.chat.id, 'Hööö?');
});