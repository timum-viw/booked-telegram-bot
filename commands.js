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
		thread.sendTyping()
		thread.authorizedGet((user) => this.booked_uri + 'Reservations/?userId=' + user.userId)
				.then((res) => {
					if(res.body.reservations.length === 0) return thread.sendMessage('No bookings found. Do you want to see /available rooms?')
					res.body.reservations.map((reservation) => {
						let startDate = new Date(Date.parse(reservation.startDate))
						let endDate = new Date(Date.parse(reservation.endDate))
						let msg = `*room:* ${reservation.resourceName}
*date:* ${startDate.toDateString()}
*time:* ${startDate.toLocaleTimeString()} - ${endDate.toTimeString()}`
						thread.sendMessage(msg, {reply_markup: {
							inline_keyboard: [[{text: 'cancel', callback_data: `cancel.${reservation.referenceNumber}`}]]
						}})
					})
				}, (err) => thread.notAuthorized())
	}

	me(thread) {
		thread.sendTyping()
		thread.authorizedGet((user) => this.booked_uri + 'Users/' + user.userId)
			.then((res) => thread.sendMessage(`You are signed up as ${res.body.firstName} ${res.body.lastName}. I have the email address ${res.body.emailAddress}.`),
			(err) => thread.notAuthorized())
	}

	available(thread) {
		thread.sendTyping()
		thread.authorizedGet(() => this.booked_uri + 'Resources/Availability')
				.then((res) => thread.sendMessage(JSON.stringify(res.body.resources)),
				(err) => thread.notAuthorized())
	}

	newThread(msg, params) {
		return new Thread(msg, params, this.mongodb, this.bot)
	}
}

module.exports = (mongodb, bot, booked_uri) => { return new Commands(mongodb, bot, booked_uri) }