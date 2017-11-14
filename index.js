const express = require('express')
const app = express()
const config = require('./config')

app.use(function (req, res, next) {
	if(req.path.substr(1) !== config.telegram.api_key) {
		res.status(401).send('unauthorized')
		return next(new Error('unauthorized'))
	}
	return next()
})

app.get('/:token', (req, res) => {
	res.send('Hello World!');
})

app.listen(config.port, () => console.log(`bot listening on port ${config.port}!`))