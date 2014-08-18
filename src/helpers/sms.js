var rest = require('restler'),
    sys = require('util');
var logger = require("../helpers/logger").getInstance();

var send = function(opt, callback) {
    var accountSid = 'AC5bb513934ab946fc9c057d3f6e2b068e',
        authToken = '8af75c81a2bddbf89ac6de23d6d26343',
        apiVersion = '2010-04-01',
        uri = '/'+apiVersion+'/Accounts/'+accountSid+'/SMS/Messages',
        host = 'api.twilio.com',
        fullURL = 'https://'+accountSid+':'+authToken+'@'+host+uri,
        from = opt.from || '14157280386',
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