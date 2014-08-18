var url = require("url");
var serviceListener = require("../model/serviceListener");
var config = require("../config/config");
var logger = require("../helpers/logger").getInstance();

function handleRequest(req, res) {
	var check_id;
    if (req.method === "GET") {
        check_id = url.parse(req.url, true).query.check_id;
    } else if (req.method === "POST") {
        check_id = req.body.check_id;
    }
    
    if (!check_id) {
        // Reset all health checks
        logger.error("restartHealthCheck() called resetting all")
        
        config.resetHealthChecks(function() {
            res.redirect('/healthDashboard');
        });
        
    } else {
        // Reset a single health check
        logger.error("restartHealthCheck() called resetting " + check_id);
        
        // Get all health Checks
        var serviceMonitors = serviceListener.getServiceMonitors();
        
        // Find the health check that you want to reset
        var healthCheck = undefined;
        var healthCheckServiceId = undefined;
        
        
        for (var serviceId in serviceMonitors) {
            var serviceHealthChecks = serviceMonitors[serviceId].healthChecks;
            for (var healthCheckId in serviceHealthChecks) {
                if (serviceHealthChecks[healthCheckId].id == check_id) {
                    healthCheck = serviceHealthChecks[healthCheckId];
                    healthCheckServiceId = serviceId;
                    break;
                }
            }
        }
    
        if (healthCheck === undefined) {
            logger.error("Could not create health check from POST request");
            return;
        }
        
        // Reset the health Check
        var serviceMonitors = serviceListener.getServiceMonitors();
        if (serviceMonitors[healthCheckServiceId]) {
            serviceMonitors[healthCheckServiceId].updateHealthCheck(healthCheck);
        }
        
        
        res.redirect('/healthDashboard');
    }
}

exports.handleRequest = handleRequest;