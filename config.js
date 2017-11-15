const config = {
	port: 5432,
	mongo_uri: 'mongodb://localhost:27017/booked-telegram-bot',
	booked: {
		url: process.env.BOOKED_URI || 'http://127.0.0.1:8080/Web/Services/index.php/',
	}
}

module.exports = config;