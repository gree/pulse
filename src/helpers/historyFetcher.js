var serviceListener = require("../model/serviceListener");
var config = require("../config/config");
var healthCheckDisplayHelper = require("./healthCheckDisplayHelper");
var logger = require("./logger").getInstance();
var dbManager = require("../db/dbManager").getInstance();

function getServiceHistory(serviceId, checkId, stateStatus, limit, offset, callback) {
    var services = serviceListener.getServices();

    config.populateServiceHistory(serviceId, checkId, stateStatus, limit, offset, function(err, results, fields) {
        
        var serviceStateDisplayArray = [];
        var hasNext = false;
        if(results.length == 21){
            results.pop();
            hasNext = true;
        }
        for (var i in results) {
            var state = results[i];
        
            // Get the service name
            var service_name = undefined;
            var service = services[state.service_id];
            if (service !== undefined) {
                var service_name = service.name;
            }
            // Get the health Check
            healthCheck = serviceListener.getHealthCheck(state.rule_id, state.service_id);
        
            if (service_name && healthCheck) {        
                serviceStateDisplayArray.push(healthCheckDisplayHelper.stateDisplayFromServiceHistory(service_name, healthCheck, state));
            } else {
                logger.error("WARN - Issue creating state display from serviceHistory.");
            }
        }

        if (callback) {
            logger.debug("getServiceHistory() callback called...")
            callback(serviceStateDisplayArray, hasNext);
        }
    });
    
}

function getFailedHistory(limit, offset, callback) {
    var services = serviceListener.getServices();
    dbManager.getFailedHistory(limit, offset, function(err, results, fields) {
        if (err) {
            logger.error(err);
            return;
        }
        
        var serviceStateDisplayArray = [];
        var hasNext = false;
        if(results.length == 21){
            results.pop();
            hasNext = true;
        }
        
        for (var i in results) {
            var state = results[i];
        
            // Get the service name
            var service_name = undefined;
            var service = services[state.service_id];
            if (service !== undefined) {
                service_name = service.name;
            }
            // Get the health Check
            var healthCheck = serviceListener.getHealthCheck(state.rule_id, state.service_id);
        
            if (service_name && healthCheck) {        
                serviceStateDisplayArray.push(healthCheckDisplayHelper.stateDisplayFromServiceHistory(service_name, healthCheck, state));
            } else {
                logger.error("WARN - Issue creating state display from serviceHistory.");
            }
        }
        if (callback) {
            logger.debug("getServiceHistory() callback called...")
            callback(serviceStateDisplayArray, hasNext);
        }
    });
}

exports.getServiceHistory = getServiceHistory;
exports.getFailedHistory = getFailedHistory;