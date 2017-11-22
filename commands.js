const superagent = require('superagent')
const Thread = require('./thread')
const config = require('./config')
const BookingParams = require('./booking-params')
const crypto = require('crypto');

class Commands {
	constructor(db, bot, booked_uri) {
		this.mongodb = db
		this.bot = bot
		this.booked_uri = booked_uri
		this.redis = new require('ioredis')(config.redis)
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
					if(res.body.reservations.length === 0) return thread.sendMessage(`I didn't find any bookings. Do you want to see /available rooms?`)
					res.body.reservations.map((reservation) => {
						let startDate = new Date(Date.parse(reservation.startDate))
						let endDate = new Date(Date.parse(reservation.endDate))
						let msg = `*room:* ${reservation.resourceName}
*date:* ${startDate.toDateString()}
*time:* ${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}`
						let options = startDate > new Date() ? {reply_markup: {
							inline_keyboard: [[{text: 'cancel', callback_data: `cancel.${reservation.referenceNumber}`}]]
						}} : {}
						thread.sendMessage(msg, options)
					})
				}, (err) => thread.notAuthorized())
	}

	me(thread) {
		thread.sendTyping()
		thread.authorizedGet((user) => this.booked_uri + 'Users/' + user.userId)
			.then((res) => thread.sendMessage(`You are signed up as ${res.body.firstName} ${res.body.lastName}. I have the email address ${res.body.emailAddress}.`),
			(err) => thread.notAuthorized())
	}

	getAvailabilities(resources, bookingParams) {
		let availabilities = []
		resources.map((resource) => {
			let slot = resource.slots.filter((s) => s.isReservable && new Date(s.startDateTime) >= bookingParams.startDateTime).shift()
			if(slot) {
				slot.startDateTime = new Date(slot.startDateTime)
				slot.endDateTime = new Date(slot.endDateTime)
				slot.resourceName = resource.resourceName
				slot.resourceId = resource.resourceId
				availabilities.push(slot)
			}
		})

		return availabilities
	}

	available(thread) {
		thread.sendTyping()
		let bookingParams = new BookingParams(thread.params, thread.bookingParams)
		if(bookingParams.complete) {
			if(bookingParams.startDateTime < new Date()) {
				return thread.sendMessage(`That's in the past. Let it go...`)
			}
			thread.authorizedGet(() => this.booked_uri + 'Schedules/1/Slots?startDateTime=' + bookingParams.startDate.toISOString() + '&endDateTime=' + bookingParams.startDate.toISOString())
				.then((res) => {
					let bookingData = []

					let availabilities = this.getAvailabilities(res.body.dates[0].resources, bookingParams)
					if(availabilities.length < 1) {
						thread.redis = {}
						return thread.sendMessage(`Sorry, I don't have any available rooms ${bookingParams.startDate.toDateString()} at ${bookingParams.time}.`)
					}

					availabilities.map((availability) => {
						let msg = `*room:* ${availability.resourceName}
*date:* ${availability.startDateTime.toDateString()}
*time:* ${availability.startDateTime.toLocaleTimeString()} - ${availability.endDateTime.toLocaleTimeString()}`

						bookingData.push({
							resourceId: availability.resourceId,
							startDateTime: availability.startDateTime,
							endDateTime: availability.endDateTime,
							id: crypto.randomBytes(8).toString('hex'),
							title: ''
						})

						thread.sendMessage(msg, {reply_markup: {
							inline_keyboard: [[{text: 'book', callback_data: `book.${bookingData[bookingData.length - 1].id}`}]]
						}})
					})

					thread.redis = {bookingData: bookingData}
					return
				},
				(err) => thread.notAuthorized(err))
		} else if (!bookingParams.date) {
			thread.sendMessage(`For *when* do you want me to look for?`, {reply_markup: {
				keyboard: [[{text: 'now'}, {text: 'today'}, {text: 'tomorrow'}]],
				resize_keyboard: true,
				one_time_keyboard: true
			}})
		} else if (!bookingParams.time) {
			thread.sendMessage(`For what *time* do you want me to look for?`, {reply_markup: {
				remove_keyboard: true
			}})
		} else {
			thread.sendMessage(`Hm.. I think I got lost. Could you restart by asking me for /available rooms?`)
		}
		thread.redis = { bookingParams }
	}

	newThread(msg, params) {
		return new Thread(msg, params, this.mongodb, this.bot, this.redis)
	}
}

module.exports = (mongodb, bot, booked_uri) => { return new Commands(mongodb, bot, booked_uri) }