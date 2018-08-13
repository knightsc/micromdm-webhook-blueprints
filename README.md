# MicroMDM Webhook Blueprints
Example webhook listeners for the MicroMDM server in different languages.

These blueprints are meant to show typical actions you might want to perform in response to the webhook functionality of the MicroMDM server. The webhook listener will watch for new devices and when one enrolls or re-enrolls it will ask the device for a list of installed applications.

All of the examples take 3 command line arguements:

* *port* - port for the webhook server to listen on (default 80)
* *server-url* - public HTTPS url of your MicroMDM server
* *api-key* - API Key for your MicroMDM server

## Go

```
cd go
go build -o micromdm-webhook
./micromdm-webhook -server-url https://my-server-url -api-key MySecretAPIKey 
```

## Python

## NodeJS
