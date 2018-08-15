import argparse
import base64
import logging
import requests
from requests.auth import HTTPBasicAuth
from flask import Flask, request


app = Flask(__name__)
server = {
    'server_url': '',
    'api_token': '',
    'devices': {},
}


@app.route('/webhook', methods=['POST'])
def webhook():
    event = request.json

    if event['topic'] == 'mdm.Authenticate':
        handle_authenticate(event)
    elif event['topic'] == 'mdm.TokenUpdate':
        handle_token_update(event)
    elif event['topic'] == 'mdm.Connect':
        handle_connect(event)
    elif event['topic'] == 'mdm.CheckOut':
        handle_check_out(event)

    return '', 200


def insert_or_update_device(udid, enrolled):
    if udid in server['devices']:
        server['devices'][udid]['enrolled'] = False
    else:
        server['devices'][udid] = {
            'udid': udid,
            'enrolled': False
        }


def handle_authenticate(event):
    """Authenticate messages are sent when the device is installing a MDM payload."""

    udid = event['checkin_event']['udid']
    insert_or_update_device(udid, False)

    if udid in server['devices']:
        app.logger.info('re-enrolling device {}'.format(udid))
    else:
        app.logger.info('enrolling new device {}'.format(udid))


def handle_token_update(event):
    """A device sends a token update message to the MDM server whenever its device
    push token, push magic, or unlock token change. The device sends an initial
    token update message to the server when it has installed the MDM payload.
    The server should send push messages to the device only after receiving the
    first token update message.
    """

    udid = event['checkin_event']['udid']
    insert_or_update_device(udid, True)

    send_command_to_device(udid, "InstalledApplicationList")


def handle_connect(event):
    """Connect events occur when a device is responding to a MDM command. They
    contain the raw responses from the device.

    https://developer.apple.com/enterprise/documentation/MDM-Protocol-Reference.pdf
    """

    xml = base64.b64decode(event['acknowledge_event']['raw_payload'])
    if 'InstalledApplicationList' in xml:
        app.logger.info(xml)


def handle_check_out(event):
    """In iOS 5.0 and later, and in macOS v10.9, if the CheckOutWhenRemoved key in
    the MDM payload is set to true, the device attempts to send a CheckOut
    message when the MDM profile is removed.
    """

    udid = event['checkin_event']['udid']
    insert_or_update_device(udid, False)


def send_command_to_device(udid, request_type):
    command = {
        'udid': udid,
        'request_type': request_type,
    }

    endpoint = server['server_url'].strip('/') + '/v1/commands'
    auth = HTTPBasicAuth('micromdm', server['api_token'])
    requests.post(endpoint, auth=auth, json=command)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        'server_url', help='public HTTPS url of your MicroMDM server')
    parser.add_argument('api_token', help='API Token for your MicroMDM server')
    parser.add_argument(
        '-p', '--port', help='port for the webhook server to listen on', default=80, type=int)
    args = parser.parse_args()
    
    server['server_url'] = args.server_url
    server['api_token'] = args.api_token

    app.logger.setLevel(logging.INFO)
    app.run(port=args.port)


if __name__ == '__main__':
    main()
