var serviceDisplayHelper = require("../helpers/serviceDisplayHelper");
var helpers = require("../helpers/helpers");
var serviceListener = require("../model/serviceListener");

function handleRequest(req, res) {
    var services = serviceDisplayHelper.getServicesForDisplay();
    for (var index in services) {
        services[index].formattedTimeCreated = helpers.formatDateString(services[index].timeCreated);
        services[index].formattedTimeModified = helpers.formatDateString(services[index].timeModified);
        services[index].shortDetails = helpers.shortenString(services[index].stateDetails);
    }
    
    res.render("services/viewAllServices.jade", {
        services: services,
        title: "Health Dashboard - Services"
    });
}

exports.handleRequest = handleRequest;