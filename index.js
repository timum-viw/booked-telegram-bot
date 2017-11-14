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

const port = process.env.PORT || config.port
app.listen(port, () => console.log(`bot listening on port ${port}!`))