const config = {
	app_url: process.env.APP_URL,
	port: 5432,
	mongo_uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/booked-telegram-bot',
	booked: {
		url: process.env.BOOKED_URI || 'http://127.0.0.1:8080/Web/Services/index.php/',
	},
	redis: process.env.REDIS_URL || '127.0.0.1:6379'
}

module.exports = config;