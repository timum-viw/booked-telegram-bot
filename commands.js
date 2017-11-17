const superagent = require('superagent')
const Thread = require('./thread')

class Commands {
	constructor(db, bot, booked_uri) {
		this.mongodb = db
		this.bot = bot
		this.booked_uri = booked_uri
	}

	start(thread) {
		const url = this.booked_uri + 'Authentication/Authenticate'
		thread.sendTyping()
		superagent.post(url)
			.send({grant_type: 'authorization_code', code: thread.params})
			.end((err, res) => {
				if(err || !res.body.isAuthenticated) {
					thread.sendMessage('Please tell me your charite.de email address to /signup for my booking services.')
					return
				}

				thread.saveAccessToken(res.body.access_token)
				thread.sendMessage('Great! You have been successfully signed up to my booking services. Feel free to ask me about available rooms to /book.')
			})
	}

	signup(thread) {
		const url = this.booked_uri + 'Telegram/signup'
		thread.sendTyping()

		superagent.post(url)
			.send({user_email: thread.params})
			.end((err, res) => {
				if(err) thread.sendMessage('Please send me a valid charite.de email address with this command.')
				else thread.sendMessage('Ok. I have sent you an email with further instruction on how to validate your account. Please check your email inbox.')
			})
	}

	bookings(thread) {
		thread.getUser().then((user) => {
			const url = this.booked_uri + 'Reservations/?userId=' + user.userId
			thread.sendTyping()

			superagent
				.get(url)
				.set('X-Authorization', `Bearer ${user.access_token}`)
				.end((err, res) => {
					if(err) return thread.notAuthorized()
					res.body.reservations.map((reservation) => {
						let msg = `*room*: ${reservation.resourceName}\n`
						let date = new Date(Date.parse(reservation.startDate))
						msg += '*date*: ' + date.toLocaleDateString()
						thread.sendMessage(JSON.stringify(msg))
					})
				})
		}, (err) => thread.notAuthorized())
	}

	me(thread) {
		thread.getUser().then((user) => {
			const url = this.booked_uri + 'Users/' + user.userId
			thread.sendTyping()

			superagent
				.get(url)
				.set('X-Authorization', `Bearer ${user.access_token}`)
				.end((err, res) => {
					if(err) thread.sendMessage('Something went wrong.. ' + err)
					else thread.sendMessage(JSON.stringify(res.body))
				})
		}, (err) => thread.notAuthorized())
	}

	newThread(msg, params) {
		return new Thread(msg, params, this.mongodb, this.bot)
	}
}

module.exports = (mongodb, bot, booked_uri) => { return new Commands(mongodb, bot, booked_uri) }