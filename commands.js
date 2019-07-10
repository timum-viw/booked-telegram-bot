const Thread = require('./thread')
const config = require('./config')
const BookingParams = require('./booking-params')
const crypto = require('crypto')
const jwt = require('jwt-simple')

class Commands {
	constructor(db, bot, booked_uri) {
		this.mongodb = db
		this.bot = bot
		this.booked_uri = booked_uri
		this.redis = new require('ioredis')(config.redis)
	}

	start(thread) {
		thread.sendTyping()
		thread.getUser().catch(() => thread.addUser())
		.then(user => {
			if(user.access_token) {
				thread.sendMessage(`Everything set up. Feel free to ask me about /available rooms.`)
			} else if(thread.params) {
				thread.validateAuthCode(thread.params)
					.then( email => {
						thread.saveAccessToken(jwt.encode({ email, aud: config.jwt.audience }, config.jwt.secret))
						thread.sendMessage('Great! You have been successfully signed up to my booking services. Feel free to ask me about /available rooms.')
					})
					.catch( () => {
						thread.sendMessage('Something went wrong. Please try to /signup again.')
					})
			} else {
				thread.redis = {action: 'signup'}
				thread.sendMessage('Please tell me your charite.de email address to signup for my booking services.')
			}
		})
	}

	signout(thread) {
		thread.sendTyping()
		thread.removeUser()
		thread.addUser()
		thread.sendMessage(`Ok. I signed you out. You have to /signup before you can use my services again.`)
	}

	signup(thread) {
		thread.sendTyping()
		thread.redis = { action: 'signup' }

		if(!thread.params) return thread.sendMessage(`Please send me your charite.de email address.`)

		thread.saveAuthCode(crypto.randomBytes(8).toString('hex'), thread.params)
			.then((res) => {
				thread.redis = null
				thread.sendMessage('Ok. I have sent you an email with further instruction on how to validate your account. Please check your email inbox.')
			}, (err) => {
				thread.sendMessage('Please send me a valid charite.de email address.')
			})
	}

	bookings(thread) {
		thread.sendTyping()
		thread.authorizedGet(() => this.booked_uri + `reservations?startDateTime=${new Date().toISOString()}&endDateTime=${new Date(new Date().valueOf() + 365 * 24 * 60 * 60 * 1000).toISOString()}`)
				.then((res) => {
					if(res.body.reservations.length === 0) return thread.sendMessage(`I didn't find any bookings. Do you want to see /available rooms?`)
					res.body.reservations.map((reservation) => {
						let startDate = new Date(Date.parse(reservation.start))
						let endDate = new Date(Date.parse(reservation.end))
						let msg = `*room:* ${reservation.resource.name}
*date:* ${startDate.toDateString()}
*time:* ${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}`
						let options = false && startDate > new Date() ? {reply_markup: {
							inline_keyboard: [[{text: 'cancel', callback_data: `cancel.${reservation.id}`}]]
						}} : {}
						thread.sendMessage(msg, options)
					})
				}, (err) => thread.notAuthorized())
	}

	me(thread) {
		thread.sendTyping()
		thread.getUser()
			.then(user => thread.sendMessage(`You are signed up as ${user.email}.`))
	}

	findAvailability(entry, start, end) {
		// reservations.sort( (a,b) => new Date(a).valueOf() - new Date(b).valueOf() )
		// let windows = reservations.reduce(( windows, reservation ) => {
		// 	windows[windows.length - 1].end = new Date(reservation.start)
		// 	windows.push({ start: new Date(reservation.end), end: new Date(start.valueOf() + 86400000) })
		// 	return windows
		// }, [{ start: new Date(start), end: new Date(start.valueOf() + 86400000)}])
		// .filter(window => window.end.valueOf() - window.start.valueOf() > end.valueOf() - start.valueOf())
		// let slot = windows.find(window => window.end > start)
		// return slot && { startDateTime: slot.start, endDateTime: new Date(slot.start.valueOf() + end.valueOf() - start.valueOf()) }
		if(!entry.reservations.every(reservation => new Date(reservation.end) < start || new Date(reservation.start) > end)) return

		let availability = {}
		availability.startDateTime = new Date(start)
		availability.endDateTime = new Date(end)
		availability.resource = entry.resource.address
		availability.id = crypto.randomBytes(8).toString('hex')
		return availability
	}

	getAvailabilities(response, bookingParams) {
		let availabilities = []
		response.map( entry => {
			let availability = this.findAvailability(entry, bookingParams.startDateTime, bookingParams.endDateTime)
			if (availability) availabilities.push(availability)
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
			thread.authorizedGet(() => this.booked_uri + 'availability?startDateTime=' + bookingParams.startDate.toISOString() + '&endDateTime=' + bookingParams.startDate.toISOString())
				.then((res) => {
					let availabilities = this.getAvailabilities(res.body.availabilities, bookingParams)
					if(availabilities.length - bookingParams.offset < 1) {
						thread.sendMessage(`Sorry, I don't have ${bookingParams.offset ? 'more' : 'any'} available rooms ${bookingParams.startDate.toDateString()} at ${bookingParams.time}.`, {reply_markup: {
							remove_keyboard: true
						}})
					} else {
						let keyboard = { remove_keyboard: true }
						if(availabilities.length > bookingParams.offset + 3) {
							keyboard = {
								keyboard: [['more results please'], ['cancel']],
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
				keyboard: [['now', 'today', 'tomorrow'],['cancel']],
				resize_keyboard: true,
				one_time_keyboard: true
			}})
		} else if (!bookingParams.time) {
			thread.sendMessage(`For what *time* do you want me to look for?`, {reply_markup: {
				remove_keyboard: true
			}})
		} else if (!bookingParams.duration) {
			thread.sendMessage(`For how *long* do you want me to look for? E.g. _2.5 hours_ `, {reply_markup: {
				keyboard: [['2 hours', '4 hours'],['cancel']],
				resize_keyboard: true,
				one_time_keyboard: true
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