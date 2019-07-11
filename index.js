const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
require('ssl-root-cas/latest').inject().addFile(__dirname + '/dfn2.crt').addFile(__dirname + '/dfn1.crt')
const config = require('./config')

var MongoClient = require('mongodb').MongoClient

MongoClient.connect(config.mongo_uri, (err, db) => {
	if (err) throw err

	const options = {
		webHook: {
			port: config.port
		}
	}

	const telegram_api_key = config.telegram.apiKey
	const bot = new TelegramBot(telegram_api_key, options)
	bot.setWebHook(`${config.app_url}/bot${telegram_api_key}`);

	let commands = require('./commands')(db, bot, config.booked.url)
	let queries = require('./queries')(db, bot, config.booked.url)

	function processCommand(msg, entity) {
		let cmd = msg.text.substr(entity.offset + 1, entity.length - 1)
		let params = msg.text.substr(entity.offset + entity.length + 1)
		let thread = commands.newThread(msg, params)
		try {
			commands[cmd](thread)
		} catch (error) {
			console.error(error)
			thread.sendMessage(`I didn't quite get that. Could you rephrase?`)
		}
	}

	bot.on('text', (msg) => {
		if(/thank/i.test(msg.text)) {
			let thread = commands.newThread(msg, msg.text)
			thread.sendMessage(`You're welcome.`)
		}
		else if(/cancel/i.test(msg.text)) {
			let thread = commands.newThread(msg, msg.text)
			thread.redis = null
			thread.sendMessage(`Ok. What's next?`, {
				reply_markup: {remove_keyboard: true}
			})
		}
		else if(msg.entities && msg.entities.find((e) => e.type === 'bot_command')) {
			msg.entities
				.filter((entity) => entity.type === 'bot_command')
				.map((entity) => processCommand(msg, entity))
		} else {
			let thread = commands.newThread(msg, msg.text)
			thread.redis.then((data) => {
				if(data && data.action) {
					commands[data.action](thread, data || {})
				} else {
					commands.available(thread, data || {})
				}
			}, (err) => console.log(err))
		}
	});

	bot.on('callback_query', (cbquery) => {
		let query, params
		[query, params] = cbquery.data.split('.')
		let thread = commands.newThread(cbquery, params)
		try {
			queries[query](thread)
		} catch (error) {
			console.error(error)
			thread.sendMessage(`Somethings wrong with that button..?`)
		}
	})

	bot.on('webhook_error', (error) => {
		//bot.sendMessage(msg.chat.id, 'Hööö?');
	});
})