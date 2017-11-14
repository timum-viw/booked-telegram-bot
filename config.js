const config = {
	port: 5432,
	telegram: {
		api_key: '488275948:AAHes6mR2xAYC_UjbWfNgQZOwjkcFWFRpdI',
	},
	mongo_uri: 'mongodb://localhost:27017/booked-telegram-bot',
	booked: {
		url: 'http://127.0.0.1:8080/Web/Services/index.php/',
	}
}

module.exports = config;