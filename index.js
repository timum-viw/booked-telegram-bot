const superagent = require('superagent');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const config = require('./config')

var MongoClient = require('mongodb').MongoClient
var mongodb;

MongoClient.connect(config.mongo_uri, function (err, db) {
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
	start(msg, params) {
		const url = config.booked.url + 'Authentication/Authenticate'
		bot.sendChatAction(msg.chat.id, 'typing')
		superagent.post(url)
			.send({grant_type: 'authorization_code', code: params})
			.end((err, res) => {
				if(err) {
					bot.sendMessage(msg.chat.id, 'Please tell me your charite.de email address to /signup for my booking services.')
					return
				}

				mongodb.collection('connections').update(
					{ chat_id: msg.from.id },
					{ chat_id: msg.from.id, access_token: res.body.access_token },
					{
						upsert: true,
					},
				);
				bot.sendMessage(msg.chat.id, 'Great! You have been successfully signed up to my booking services. Feel free to ask me about available rooms to /book.')
			})
	},

	signup(msg, params) {
		const url = config.booked.url + 'Telegram/signup'
		bot.sendChatAction(msg.chat.id, 'typing')

		superagent.post(url)
			.send({user_email: params})
			.end((err, res) => {
				if(err) bot.sendMessage(msg.chat.id, 'Please send me a valid charite.de email address with this command.')
				else bot.sendMessage(msg.chat.id, 'Ok. I have sent you an email with further instruction on how to validate your account. Please check your email inbox.')
			})
	},

	bookings(msg, params) {
		mongodb.collection('connections').findOne({ chat_id: msg.from.id }, (err, user) => {

			function notAuthorized() {
				bot.sendMessage(msg.chat.id, 'You have to be signed up to use my services. Please use /signup _your.email.address@charite.de_ to sign up with your email.', {parse_mode: 'Markdown'})
			}

			console.log(user)
			if(!user) return notAuthorized()
			const url = config.booked.url + 'Reservations/'
			bot.sendChatAction(msg.chat.id, 'typing')

			superagent
				.get(url)
				.set('X-Authorization', `Bearer ${user.access_token}`)
				.end((err, res) => {
					if(err) bot.sendMessage(msg.chat.id, 'Something went wrong.. ' + err)
					else bot.sendMessage(msg.chat.id, JSON.stringify(res.body.reservations))
				})
		})
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