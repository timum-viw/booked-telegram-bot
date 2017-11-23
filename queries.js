const superagent = require('superagent')

class Queries {
	constructor(db, bot, booked_uri) {
		this.mongodb = db
		this.bot = bot
		this.booked_uri = booked_uri
	}

	cancel(thread) {
		thread.sendTyping()
		thread.authorizedDelete(() => this.booked_uri + 'Reservations/' + thread.params)
			.then(() => {
					thread.sendMessage(`Booking is gone. Enjoy your free time!`)
					thread.deleteMessage()
				},
				(err) => thread.notAuthorized())
	}

	book(thread) {
		thread.redis.then((data) => {
			if(!(data && data.availabilities)) {
				return thread.sendMessage(`Please ask me about /available rooms first.`)
			}
			let availability = data.availabilities.find((b) => b.id === thread.params)
			if(!availability) return thread.sendMessage(`That didn't work out...`)
			thread.authorizedPost(() => this.booked_uri + 'Reservations/', {...availability, title: ''}).then((res) => {
				thread.sendMessage('Alright, I booked the room for you. Enjoy your time!', {
					reply_markup: {remove_keyboard: true}
				})
				thread.removeInlineKeyboard()
			}, (err) => thread.sendMessage(`I couldn't book the room. No idea why... please ask me again about /available rooms.`))
		})
	}
}

module.exports = (mongodb, bot, booked_uri) => { return new Queries(mongodb, bot, booked_uri) }