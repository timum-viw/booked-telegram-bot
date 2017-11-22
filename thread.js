const superagent = require('superagent')

class Thread {
	constructor(msg, params, db, bot, redis) {
		this.msg = msg
		this.params = params
		this.mongodb = db
		this.bot = bot
		this._redis = redis

		this.chat_id = this.msg.chat ? this.msg.chat.id : this.msg.message.chat.id
	}

	sendMessage(msg, options) {
		options = { parse_mode: 'Markdown', ...options }
		this.bot.sendMessage(this.chat_id, msg, options)
	}

	sendTyping() {
		this.bot.sendChatAction(this.chat_id, 'typing')
	}

	getUser() {
		return this.mongodb.collection('connections')
			.findOne({ chat_id: this.msg.from.id })
			.then((user) => {
				user.userId = require('jwt-decode')(user.access_token).userId;
				return user;
			})
	}

	get redis() {
		return this.getUser().then((user) => {
			return this._redis.get(user._id)
						.then((data) => JSON.parse(data)) 
		})
	}

	set redis(data) {
		this.getUser().then((user) => {
			this._redis.set(user._id, JSON.stringify(data), 'EX', 600)
		})
	}

	saveAccessToken(token) {
		this.mongodb.collection('connections').update(
			{ chat_id: this.msg.from.id },
			{ chat_id: this.msg.from.id, access_token: token },
			{
				upsert: true,
			},
		);
	}

	deleteMessage() {
		this.bot.deleteMessage(this.msg.message.chat.id, this.msg.message.message_id)
	}

	answerCallbackQuery(msg) {
		this.bot.answerCallbackQuery({callback_query_id: this.msg.id, text: msg})
	}

	removeInlineKeyboard() {
		this.bot.editMessageReplyMarkup({}, {chat_id: this.msg.message.chat.id, message_id: this.msg.message.message_id})
	}

	notAuthorized(err) {
		console.log(err)
		this.sendMessage('You have to be signed up to use my services. Please use /signup _your.email.address@charite.de_ to sign up with your email.')
	}

	authorizedGet(url) {
		return this.getUser().then((user) => {
			return superagent
				.get(url(user))
				.set('X-Authorization', `Bearer ${user.access_token}`)
		})
	}

	authorizedPost(url, data) {
		return this.getUser().then((user) => {
			return superagent
				.post(url(user))
				.send(data)
				.set('X-Authorization', `Bearer ${user.access_token}`)
		})
	}

	authorizedDelete(url) {
		return this.getUser().then((user) => {
			return superagent
				.delete(url(user))
				.set('X-Authorization', `Bearer ${user.access_token}`)
		})
	}
}

module.exports = Thread