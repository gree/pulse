var dateFormat = require('dateformat');

var instance;
var isDebugMode;

function Logger() {
}

function getInstance() {
    if (!instance) {
        instance = new Logger();
    }
    return instance;
}

Logger.prototype.debug = function(msg) {
    if (this.isDebugMode) {
        log("DEBUG: " + msg);
    } else if (typeof(msg) == 'object' && msg.stack ) {
        log("DEBUG: " + msg.stack);
    }
}

Logger.prototype.info = function(msg) {
    if (typeof(msg) == 'object' && msg.stack ) {
        if (msg.message) {
            log("INFO: " + msg.message);
        }
        log("INFO: " + msg.stack);
    }  else {
        log("INFO: " + msg);
    }
}

Logger.prototype.error = function(msg) {
    if (typeof(msg) == 'object' && msg.stack ) {
        if (msg.message) {
            log("ERROR: " + msg.message);
        }

        log("ERROR: " + msg.stack);
    }  else {
        log("ERROR: " + msg);
    }
}

function log(msg) {
    var now = new Date();
    var timestr = dateFormat(now, "yyyy-mm-dd HH:MM:ss");
    console.log(timestr + "  " + msg);
}

exports.getInstance = getInstance;
