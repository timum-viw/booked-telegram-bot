class Thread {
	constructor(msg, params, db, bot) {
		this.msg = msg
		this.params = params
		this.mongodb = db
		this.bot = bot
	}

	sendMessage(msg) {
		this.bot.sendMessage(this.msg.chat.id, msg, {parse_mode: 'Markdown'})
	}

	sendTyping() {
		this.bot.sendChatAction(this.msg.chat.id, 'typing')
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
}

module.exports = Thread