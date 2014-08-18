var url = require("url");
var CheckDisplays = require("../model/checkDisplays");
var helpers = require("../helpers/helpers");
var serviceListener = require("../model/serviceListener");
var healthCheckDisplayHelper = require("../helpers/healthCheckDisplayHelper");

function handleRequest(req, res) {
    // Try to get the service from GET request parameters first, but since it might be coming from a POST check the POST parameters also
    var service_id;
    if (req.method === "GET") {
        service_id = url.parse(req.url, true).query.service_id;
    } else if (req.method === "POST") {
        service_id = req.body.service_id;
    }

    var healthChecks = healthCheckDisplayHelper.getHealthChecksForDisplay(service_id);
    var services = serviceListener.getServices();
	for (var index in healthChecks) {
	    var checkDisplay = CheckDisplays.getHealthCheckDisplay(healthChecks[index].check_type);
        if (checkDisplay === undefined) {
            console.error("ERROR - Check Type " + healthChecks[index].check_type + " does not exist.");
        }
		healthChecks[index].displayCheckType = checkDisplay.displayName;
    	healthChecks[index].formattedPeriod = helpers.getIntervalString(healthChecks[index].period);
    	//healthChecks[index].displayProperty = helpers.getDisplayProperty(healthChecks[index].property);
    	healthChecks[index].formattedTimeCreated = helpers.formatDateString(healthChecks[index].timeCreated);
		healthChecks[index].formattedTimeModified = helpers.formatDateString(healthChecks[index].timeModified);
	}
	
    var service_name = "All";

	if (service_id !== undefined) {
	    var service = services[service_id];
        if (service !== undefined) {
            service_name = service.name;
        }       
    }
	var referrer = "/viewServiceChecks";
	if(service_id !== undefined){
	    referrer+="?service_id="+service_id;
	}
    res.render("checks/viewAllChecks.jade", {
        checks: healthChecks,
        title: "Health Dashboard - " + service_name + " Checks",
        service_id: service_id,
        service_name: service_name,
        services: services,
        referrer: referrer
    });
}

exports.handleRequest = handleRequest;