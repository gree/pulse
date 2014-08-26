var rest = require('restler'),
    sys = require('util');
var logger = require("../helpers/logger").getInstance();

var send = function(opt, callback) {
    var accountSid = 'account_sid',
        authToken = 'auth_token',
        apiVersion = '2010-04-01',
        uri = '/'+apiVersion+'/Accounts/'+accountSid+'/SMS/Messages',
        host = 'api.twilio.com',
        fullURL = 'https://'+accountSid+':'+authToken+'@'+host+uri,
        from = opt.from || 'from_number',
        to = opt.to,
        body = opt.body;

    if (body.length > 160) {
        body = body.substring(0, 157) + '...';
    }

    rest.post(fullURL, {
        data: { From:from, To:to, Body:body }
    }).addListener('complete', function(data, response) {
        if (callback) {
            callback();
        }
    }).on('error', function(err) {
        logger.error('error sending sms message to: ' + to + " error: " + JSON.stringify(err));
    });
};

exports.send = send;