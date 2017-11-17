const superagent = require('superagent');

class Commands {
	constructor(db, bot, booked_uri) {
		this.mongodb = db
		this.bot = bot
		this.booked_uri = booked_uri
	}

	start(msg, params) {
		const url = this.booked_uri + 'Authentication/Authenticate'
		this.bot.sendChatAction(msg.chat.id, 'typing')
		superagent.post(url)
			.send({grant_type: 'authorization_code', code: params})
			.end((err, res) => {
				if(err) {
					this.bot.sendMessage(msg.chat.id, 'Please tell me your charite.de email address to /signup for my booking services.')
					return
				}

				this.mongodb.collection('connections').update(
					{ chat_id: msg.from.id },
					{ chat_id: msg.from.id, access_token: res.body.access_token },
					{
						upsert: true,
					},
				);
				this.bot.sendMessage(msg.chat.id, 'Great! You have been successfully signed up to my booking services. Feel free to ask me about available rooms to /book.')
			})
	}

	signup(msg, params) {
		const url = this.booked_uri + 'Telegram/signup'
		this.bot.sendChatAction(msg.chat.id, 'typing')

		superagent.post(url)
			.send({user_email: params})
			.end((err, res) => {
				if(err) this.bot.sendMessage(msg.chat.id, 'Please send me a valid charite.de email address with this command.')
				else this.bot.sendMessage(msg.chat.id, 'Ok. I have sent you an email with further instruction on how to validate your account. Please check your email inbox.')
			})
	}

	bookings(msg, params) {
		this.mongodb.collection('connections').findOne({ chat_id: msg.from.id }, (err, user) => {
			if(!user) return notAuthorized(msg)
			let userId = require('jwt-decode')(user.access_token).userId;
			const url = this.booked_uri + 'Reservations/?userId=' + userId
			this.bot.sendChatAction(msg.chat.id, 'typing')

			superagent
				.get(url)
				.set('X-Authorization', `Bearer ${user.access_token}`)
				.end((err, res) => {
					if(err) notAuthorized(msg)
					else this.bot.sendMessage(msg.chat.id, JSON.stringify(res.body.reservations))
				})
		})
	}

	me(msg, params) {
		this.mongodb.collection('connections').findOne({ chat_id: msg.from.id }, (err, user) => {
			if(!user) return notAuthorized(msg)
			let userId = require('jwt-decode')(user.access_token).userId
			const url = this.booked_uri + 'Users/' + userId
			this.bot.sendChatAction(msg.chat.id, 'typing')

			superagent
				.get(url)
				.set('X-Authorization', `Bearer ${user.access_token}`)
				.end((err, res) => {
					if(err) this.bot.sendMessage(msg.chat.id, 'Something went wrong.. ' + err)
					else this.bot.sendMessage(msg.chat.id, JSON.stringify(res.body))
				})
		})
	}

	notAuthorized(msg) {
		this.bot.sendMessage(msg.chat.id, 'You have to be signed up to use my services. Please use /signup _your.email.address@charite.de_ to sign up with your email.', {parse_mode: 'Markdown'})
	}
}

module.exports = (mongodb, bot, booked_uri) => { return new Commands(mongodb, bot, booked_uri) }