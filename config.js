const config = {
	app_url: process.env.APP_URL,
	port: process.env.PORT || 5432,
	mongo_uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/booked-telegram-bot',
	booked: {
		url: process.env.BOOKED_URI || 'http://localhost:4321/',
	},
	redis: process.env.REDIS_URL || '127.0.0.1:6379',
	telegram: {
		apiKey: process.env.TELEGRAM_API_KEY,
	},
	jwt: {
		audience: process.env.JWT_AUDIENCE || 'http://localhost:4321/',
		secret: process.env.JWT_SECRET
	}
}

module.exports = config;