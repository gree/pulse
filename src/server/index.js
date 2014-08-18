var Email = require("../helpers/email");
var logger = require("../helpers/logger").getInstance();
var environment = require("../config/environment").getInstance();
var regClient = require("../helpers/registryClient");

var debug = true;
var port = 8000;//default to 8000 on dev, port 80 for prod
var env = "dev";
for (var i = 0; i < process.argv.length; i++) {
    var arg = process.argv[i];
    if (arg === "-debug") {
        debug = process.argv[i + 1];
    }
    if (arg === "-port") {
        port = process.argv[i + 1];
    }
    if (arg === "-env") {
        env = process.argv[i + 1];
    }
}

logger.isDebugMode = debug;


//process.on('uncaughtException', function(err,callback) {
//    console.log("handled uncaught exception: "  + err);
//    if (err && err.stack) {
//        console.log(err.stack);
//    }
//    callback();
//  });
// TODO - change to email list?
Email.sendEmail({to : 'email@email.com', 'subject' : 'restarted health check server'});

//mySqlDbManager.initDatabase(function() {
//        aggregationServer.start(serviceHandler);
//        dashboardServer.start(port);
//        logger.info('Initializing server...');
//});

environment.loadEnvironment(env,function(){
        var mySqlDbManager = require("../db/mySqlDbManager");
        mySqlDbManager.initDatabase(function() {
            var aggregationServer = require("./aggregationServer");
            var dashboardServer = require("./dashboardServer");
            var serviceHandler = require("../model/serviceListener");
            aggregationServer.start(serviceHandler);
            dashboardServer.start(port);
            logger.info('Initializing server...');
            regClient.registerServiceStart( {port:port} );
    });
});
