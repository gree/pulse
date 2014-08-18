var url = require("url");
var healthCheckDisplayHelper = require("../helpers/healthCheckDisplayHelper");
var helpers = require("../helpers/helpers")
var CheckDisplays = require("../model/checkDisplays");
var serviceListener = require("../model/serviceListener");

function handleRequest(req, res) {
	var service_id;
    if (req.method === "GET") {
        service_id = url.parse(req.url, true).query.service_id;
    } else if (req.method === "POST") {
        service_id = req.body.service_id;
    }
    
    var serviceStates = healthCheckDisplayHelper.getHealthChecksForDisplay();
	var service_name = "All"
	
    var displayServiceStates = [];

    if (service_id === undefined) {
        // Get serviceStates for all services
        displayServiceStates = serviceStates;
    } else {
        // Get serviceStates for one services 
        for (var index in serviceStates) {
            var currentServiceState = serviceStates[index];
            if (service_id == currentServiceState.service_id) {
                displayServiceStates.push(currentServiceState);
                service_name = currentServiceState.service_name;
            }
        }
    }
    
    // Format the last received time for readability and compactness
    for (var index in displayServiceStates) {
        var checkDisplay = CheckDisplays.getHealthCheckDisplay(displayServiceStates[index].check_type);
        if (checkDisplay === undefined) {
            console.error("ERROR - Check Type " + healthChecks[index].check_type + " does not exist.");
        }
        displayServiceStates[index].displayCheckType = checkDisplay.displayName;
        displayServiceStates[index].short_details = helpers.shortenString(displayServiceStates[index].details);
		displayServiceStates[index].formattedLastReceived = helpers.formatDateString(displayServiceStates[index].lastReceived);
	}
	var referrer = "/healthDashboard";
	if(service_id != undefined){
	    referrer+="?service_id="+service_id;
	}
    res.render("healthDashboard.jade", {
        services: serviceListener.getServices(),
        serviceStates: displayServiceStates,
        title: "Health Dashboard - " + service_name,
		history: false,
		service_name: service_name,
		referrer:referrer
    });
}

exports.handleRequest = handleRequest;