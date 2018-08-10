'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const app = express().use(bodyParser.json());

app.post('/webhook', (req, res) => {
    console.log(req.body);
    res.sendStatus(200)
});

app.listen(8081, () => console.log('server started'));
