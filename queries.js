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
			.then(() => thread.sendMessage(`Booking is gone. Enjoy your free time!`),
				(err) => thread.sendMessage(`That didn't work out..`))
	}
}

module.exports = (mongodb, bot, booked_uri) => { return new Queries(mongodb, bot, booked_uri) }