var url = require("url");
var serviceStateBridge = require("../model/serviceStateBridge");

function handleRequest(req, res) {
    //Try to get the service from GET request parameters first, but since it might be coming from a POST check the POST parameters also
    var service;
    if (req.method === "GET") {
        service_id = url.parse(req.url, true).query.service_id;
    } else if (req.method === "POST") {
        service_id = req.body.service_id;
    }
    var rules = serviceStateBridge.getRules(service);
    res.render("viewAllRules.jade", {
        rules: rules,
        title: "Health Dashboard -" + service + " Rules",
        service: service
    });
}

exports.handleRequest = handleRequest;