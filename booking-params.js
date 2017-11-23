class BookingParams {
	constructor(str, params = {}) {
		this.date = params.date
		this.time = params.time
		this.duration = params.duration
		this.parse(str)
	}

	parse(str) {
		let weekdays = ['sunday', 'monday','tuesday','wednesday','thursday','friday','saturday']
		if(/now/i.test(str)) {
			this.date = new Date()
			this.time = this.date.getHours().toString().padStart(2, '0')+(this.date.getMinutes()+2).toString().padStart(2, '0')
		}
		else if(/today/i.test(str)) this.date = new Date()
		else if(/tomorrow/i.test(str)) this.date = new Date().setDate(new Date().getDate() + 1)
		let date = str.match(new RegExp(weekdays.join('|'), 'i'))
		if(date) {
			this.date = new Date()
			this.date.setDate(this.date.getDate() + (weekdays.indexOf(date.pop().toLowerCase()) + 6 - this.date.getDay()) % 7 + 1)
		}
		date = str.match(/\b(3[01]|[0-2]?\d)\.(1[0-2]|0?[1-9])\b/)
		if(date) {
			this.date = new Date()
			this.date.setMonth(date.pop() - 1,date.pop())
			if(this.date.getMonth() < new Date().getMonth()) this.date.setFullYear(this.date.getFullYear() + 1)
		}

		let time = str.match(/\b(2[0-3]|[01]?\d):?([0-5]\d)\b/)
		if(time) {
			this.time = time[1].padStart(2, '0')+time[2]
			if(!this.date) this.date = new Date()
		}
	}

	get complete() {
		return this.date && this.time
	}

	get startDateTime() {
		let d = new Date(this.date)
		d.setHours(this.time.substr(0,2),this.time.slice(-2), 0, 0)
		return d
	}

	get startDate() {
		let d = new Date(this.date)
		d.setUTCHours(0, 0, 0, 0)
		return d
	}
}

module.exports = BookingParams