class BookingParams {
	constructor(str, params = {}) {
		this.date = params.date
		this.time = params.time
		this.duration = params.duration
		this.parse(str)
	}

	parse(str) {
		if(/now/i.test(str)) {
			this.date = new Date()
			this.time = this.date.getHours().toString().padStart(2, '0')+this.date.getMinutes().toString().padStart(2, '0')
		}
		else if(/today/i.test(str)) this.date = new Date()
		else if(/tomorrow/i.test(str)) this.date = new Date().setDate(new Date().getDate() + 1)
		let time = str.match(/\b(2[0-3]|[01]?\d):?([0-5]\d)\b/)
		if(time) this.time = time[1].padStart(2, '0')+time[2]
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