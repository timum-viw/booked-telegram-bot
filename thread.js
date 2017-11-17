const superagent = require('superagent')

class Thread {
	constructor(msg, params, db, bot) {
		this.msg = msg
		this.params = params
		this.mongodb = db
		this.bot = bot
	}

	sendMessage(msg, options) {
		options = { parse_mode: 'Markdown', ...options }
		this.bot.sendMessage(this.msg.from.id, msg, options)
	}

	sendTyping() {
		this.bot.sendChatAction(this.msg.from.id, 'typing')
	}

	getUser() {
		return this.mongodb.collection('connections')
			.findOne({ chat_id: this.msg.from.id })
			.then((user) => {
				user.userId = require('jwt-decode')(user.access_token).userId;
				return user;
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

	notAuthorized(err) {
		this.sendMessage('You have to be signed up to use my services. Please use /signup _your.email.address@charite.de_ to sign up with your email.' + err)
	}

	authorizedGet(url) {
		return this.getUser().then((user) => {
			return superagent
				.get(url(user))
				.set('X-Authorization', `Bearer ${user.access_token}`)
		})
	}

	authorizedPost(url) {
		return this.getUser().then((user) => {
			return superagent
				.post(url(user))
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