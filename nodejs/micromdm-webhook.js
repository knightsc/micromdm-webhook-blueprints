'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const url = require('url');

const app = express().use(bodyParser.json({limit: '50mb'}));
const server = {
    'server_url': '',
    'api_token': '',
    'port': 80,
    'devices': {},
}

app.post('/webhook', (req, res) => {
    var event = req.body
    switch (req.body.topic) {
        case 'mdm.Authenticate':
            handleAuthenticate(event)
            break
        case 'mdm.TokenUpdate':
            handleTokenUpdate(event)
            break
        case 'mdm.Connect':
            handleConnect(event)
            break
        case 'mdm.CheckOut':
            handleCheckOut(event)
            break
    }

    res.sendStatus(200)
});

/**
 * Authenticate messages are sent when the device is installing a MDM payload.
 * @param {*} event The webhook event
 */
function handleAuthenticate(event) {
    var udid = event.checkin_event.udid

    if (udid in server.devices) {
        console.log('re-enrolling device ' + udid)
    } else {
        console.log('enrolling new device ' + udid)
    }

    insertOrUpdateDevice(udid, false)
}

/**
 * A device sends a token update message to the MDM server whenever its device
 * push token, push magic, or unlock token change. The device sends an initial
 * token update message to the server when it has installed the MDM payload.
 * The server should send push messages to the device only after receiving the
 * first token update message.
 * @param {*} event The webhook event 
 */
function handleTokenUpdate(event) {
    var udid = event.checkin_event.udid
    insertOrUpdateDevice(udid, true)

    sendCommandToDevice(udid, "InstalledApplicationList")
}

/**
 * Connect events occur when a device is responding to a MDM command. They
 * contain the raw responses from the device.
 *
 * https://developer.apple.com/enterprise/documentation/MDM-Protocol-Reference.pdf
 * @param {*} event The webhook event 
 */
function handleConnect(event) {
    var xml = Buffer.from(event.acknowledge_event.raw_payload, 'base64').toString("ascii")
    if (xml.indexOf('InstalledApplicationList') > -1) {
        console.log(xml)
    }
}

/**
 * In iOS 5.0 and later, and in macOS v10.9, if the CheckOutWhenRemoved key in
 * the MDM payload is set to true, the device attempts to send a CheckOut
 * message when the MDM profile is removed.
 * @param {*} event The webhook event 
 */
function handleCheckOut(event) {
    var udid = event.checkin_event.udid
    insertOrUpdateDevice(udid, false)
}

function insertOrUpdateDevice(udid, enrolled) {
    if (udid in server.devices) {
        server.devices[udid]['enrolled'] = false
    } else {
        server.devices[udid] = {
            'udid': udid,
            'enrolled': false
        }
    }
}

function sendCommandToDevice(udid, requestType) {
    var command = JSON.stringify({
        'udid': udid,
        'request_type': requestType,
    })

    var serverURL = new URL(server.server_url)
    var auth = 'Basic ' + Buffer.from('micromdm:' + server.api_token).toString('base64');
    var options = {
      hostname: serverURL.hostname,
      port: 443,
      path: '/v1/commands',
      method: 'POST',
      headers: {
           'Content-Type': 'Content-type: application/json; charset=utf-8',
           'Content-Length': command.length,
           'Authorization': auth
         }
    };
    
    var req = https.request(options, null)
    req.on('error', (e) => {
        console.error(e);
    })
    req.write(command)
    req.end()
}

function main() {
    parseArgs()
    app.listen(server.port, () => console.log('server started on port ' + server.port));
}

function parseArgs() {
    server.server_url = process.argv[2]
    server.api_token = process.argv[3]
    if (process.argv[4]) {
        server.port = parseInt(process.argv[4])
    }
    
    if (server.server_url == null || server.api_token == null || isNaN(server.port)) {
        console.log('usage: micromdm-webhook.js server_url api_token port')
        process.exit(1)
    }
}

if (require.main === module) {
    main();
}
