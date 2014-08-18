var CONTROLLER_DIRECTORY = "../controllers/";

var methodMap = [];

//Definition of all request handlers, add any new handlers here
methodMap["/healthCheck"] = require(CONTROLLER_DIRECTORY + "healthCheck");
methodMap["/healthDashboard"] = require(CONTROLLER_DIRECTORY + "healthDashboard");
methodMap["/index.html"] = require(CONTROLLER_DIRECTORY + "viewServices");
methodMap["/"] = require(CONTROLLER_DIRECTORY + "viewServices");
methodMap["/restartHealthCheck"] = require(CONTROLLER_DIRECTORY + "restartHealthCheck");
methodMap["/viewServiceRules"] = require(CONTROLLER_DIRECTORY + "viewServiceRules");
methodMap["/editRule"] = require(CONTROLLER_DIRECTORY + "editRule");
methodMap["/removeRule"] = require(CONTROLLER_DIRECTORY + "removeRule");
methodMap["/addRule"] = require(CONTROLLER_DIRECTORY + "addRule");
methodMap["/viewRule"] = require(CONTROLLER_DIRECTORY + "viewRule");
methodMap["/editCheck"] = require(CONTROLLER_DIRECTORY + "editCheck");
methodMap["/viewCheck"] = require(CONTROLLER_DIRECTORY + "viewCheck");
methodMap["/viewServiceChecks"] = require(CONTROLLER_DIRECTORY + "viewServiceChecks");
methodMap["/viewServices"] = require(CONTROLLER_DIRECTORY + "viewServices");
methodMap["/viewService"] = require(CONTROLLER_DIRECTORY + "viewService");
methodMap["/editService"] = require(CONTROLLER_DIRECTORY + "editService");
methodMap["/addService"] = require(CONTROLLER_DIRECTORY + "addService");
methodMap["/removeService"] = require(CONTROLLER_DIRECTORY + "removeService");
methodMap["/disableService"] = require(CONTROLLER_DIRECTORY + "disableService");
methodMap["/enableService"] = require(CONTROLLER_DIRECTORY + "enableService");
methodMap["/viewServiceHistory"] = require(CONTROLLER_DIRECTORY + "viewServiceHistory");
methodMap["/viewFailedHistory"] = require(CONTROLLER_DIRECTORY + "viewFailedHistory");
methodMap["/isValidVerticaQuery"] = require(CONTROLLER_DIRECTORY + "isValidVerticaQuery");
methodMap["/fetchConfigs"] = require(CONTROLLER_DIRECTORY + "fetchConfigs");
methodMap["/addTemplate"] = require(CONTROLLER_DIRECTORY + "addTemplate");
methodMap["/viewTemplates"] = require(CONTROLLER_DIRECTORY + "viewTemplates");

function getRequestHandler(path) {
    return methodMap[path];
}
exports.getRequestHandler = getRequestHandler;
