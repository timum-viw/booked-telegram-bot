const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const config = require('./config')

var MongoClient = require('mongodb').MongoClient

MongoClient.connect(config.mongo_uri, (err, db) => {
	if (err) throw err

	const options = {
		webHook: {
			port: process.env.PORT || config.port
		}
	}

	const telegram_api_key = process.env.TELEGRAM_API_KEY
	const bot = new TelegramBot(telegram_api_key, options)

	let commands = require('./commands')(db, bot, config.booked.url)

	function processCommand(msg, entity) {
		let cmd = msg.text.substr(entity.offset + 1, entity.length - 1)
		let params = msg.text.substr(entity.offset + entity.length + 1)
		let thread = commands.newThread(msg, params)
		if(commands[cmd]) {
			commands[cmd](thread)
		}
	}

	bot.on('text', function onMessage(msg) {
		commands.msg = msg
		if(msg.entities) {
			msg.entities
				.filter((entity) => entity.type === 'bot_command')
				.map((entity) => processCommand(msg, entity))
		}
	});

	bot.on('webhook_error', (error) => {
		//bot.sendMessage(msg.chat.id, 'Hööö?');
	});
})