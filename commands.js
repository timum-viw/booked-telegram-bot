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
			.then((res) => {
				thread.saveAccessToken(res.body.access_token)
				thread.sendMessage('Great! You have been successfully signed up to my booking services. Feel free to ask me about /available rooms.')
			}, (err) => {
				thread.redis = {action: 'signup'}
				thread.sendMessage('Please tell me your charite.de email address to signup for my booking services.')
			})
	}

	signup(thread) {
		const url = this.booked_uri + 'Telegram/signup'
		thread.sendTyping()
		thread.redis = { action: 'signup' }

		if(!thread.params) return thread.sendMessage(`Please send me your charite.de email address.`)

		superagent.post(url)
			.send({user_email: thread.params})
			.then((res) => {
				thread.redis = null
				thread.sendMessage('Ok. I have sent you an email with further instruction on how to validate your account. Please check your email inbox.')
			}, (err) => {
				thread.sendMessage('Please send me a valid charite.de email address.')
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
			let slots = resource.slots.filter((s) => s.isReservable && new Date(s.startDateTime) >= bookingParams.startDateTime)
			let availability = slots.reduce((availability, slot) => {
				if(availability.startDateTime && new Date(slot.startDateTime).getTime() != availability.endDateTime.getTime()) {
					availabilities.push({...availability})
					delete availability.startDateTime
				}
				if(!availability.startDateTime) availability.startDateTime = new Date(slot.startDateTime)
				availability.endDateTime = new Date(slot.endDateTime)
				availability.resourceName = resource.resourceName
				availability.resourceId = resource.resourceId
				availability.id = crypto.randomBytes(8).toString('hex')
				return availability
			}, {})
			if(availability.startDateTime) availabilities.push(availability)
		})

		return availabilities
	}

	sendAvailabilities(thread, availabilities) {
		availabilities.map((availability) => {
			let msg = `*room:* ${availability.resourceName}
*date:* ${availability.startDateTime.toDateString()}
*time:* ${availability.startDateTime.toLocaleTimeString()} - ${availability.endDateTime.toLocaleTimeString()}`

			thread.sendMessage(msg, {reply_markup: {
				inline_keyboard: [[{text: 'book', callback_data: `book.${availability.id}`}]]
			}})
		})
	}

	available(thread, redisData = {}) {
		thread.sendTyping()
		let bookingParams = new BookingParams(thread.params, redisData.bookingParams)
		if(bookingParams.complete) {
			if(bookingParams.startDateTime < new Date()) {
				return thread.sendMessage(`That's in the past. Let it go...`)
			}
			thread.authorizedGet(() => this.booked_uri + 'Schedules/1/Slots?startDateTime=' + bookingParams.startDate.toISOString() + '&endDateTime=' + bookingParams.startDate.toISOString())
				.then((res) => {
					let availabilities = this.getAvailabilities(res.body.dates[0].resources, bookingParams)
					if(availabilities.length - bookingParams.offset < 1) {
						thread.sendMessage(`Sorry, I don't have ${bookingParams.offset ? 'more' : 'any'} available rooms ${bookingParams.startDate.toDateString()} at ${bookingParams.time}.`, {reply_markup: {
							remove_keyboard: true
						}})
					} else {
						let keyboard = { remove_keyboard: true }
						if(availabilities.length > bookingParams.offset + 3) {
							keyboard = {
								keyboard: [['more results please']],
								resize_keyboard: true,
								one_time_keyboard: true
							}
						}
						thread.sendMessage(`What do you think?`, {reply_markup: keyboard})
						availabilities = availabilities.slice(bookingParams.offset,bookingParams.offset + 3)
						this.sendAvailabilities(thread, availabilities)
					}

					return thread.redis = {bookingParams, availabilities: availabilities.concat(redisData.availabilities || []) }
				},
				(err) => thread.notAuthorized(err))
		} else if (!bookingParams.date) {
			thread.sendMessage(`For *when* do you want me to look for? E.g. _now_ or _friday 9:00_ or _9.10. 9:45_ etc..`, {reply_markup: {
				keyboard: [['now', 'today', 'tomorrow']],
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
		thread.redis = { action: 'available', bookingParams }
	}

	newThread(msg, params) {
		return new Thread(msg, params, this.mongodb, this.bot, this.redis)
	}
}

module.exports = (mongodb, bot, booked_uri) => { return new Commands(mongodb, bot, booked_uri) }