var Email = require("mailer");
var logger = require("../helpers/logger").getInstance();

// Supports AWS SES
function sendEmail(options) {
    var config  = {
    ssl: true,
    host : "",              // smtp server hostname
    port : 465,                     // smtp server port
    domain : "[127.0.0.1]",            // domain used by client to identify itself to server
    to : "",
    from : "",
    subject : "Health Check Notification",
    body: "Health Check notification",
    authentication : "login",        // auth login is supported; anything else is no auth
    username : '',            // username
    password : '',            // password
    debug: true                      // log level per message
    };
  options = options || {};
  for (var key in config) {
      if (!options[key]) {
          options[key] = config[key];
      }
  }

Email.send(options,
  function(error, success){
      logger.debug('Email response: ' + (success ? 'sent' : 'failed'));
      if (error) logger.error(error);
    });
}

exports.sendEmail = sendEmail;
