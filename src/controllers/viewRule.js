var url = require("url");
var serviceStateBridge = require("../model/serviceStateBridge");
var logger = require("../helpers/logger").getInstance();

function handleRequest(req, res) {
    var queryString = url.parse(req.url, true).query;
    if (req.method === "POST") {
        queryString = req.body;
    }
    var rule;
    var action;
    var services = serviceStateBridge.getServices();
    if (queryString.action === "add") {
        rule = serviceStateBridge.newRule('', '', '', queryString.service_id, 0, new Date(), new Date());
        action = "/addRule";
    } else {
        rule = serviceStateBridge.newRule(queryString.ruleName, queryString.ruleType, queryString.ruleValue, queryString.service_id, queryString.id, queryString.timeCreated, new Date());
        action = "/editRule";
    }
    logger.debug(queryString)
    var service = services[queryString.service_id];
    var service_name = undefined;
    if (service !== undefined) {
        service_name = service.name;
    }
    
    res.render("viewRule.jade", {
        rule: rule,
        title: "Health Dashboard -" + service_name + " Rule",
        action: action,
		services: services
    });
}

exports.handleRequest = handleRequest;