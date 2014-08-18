var dbManager = require("../db/dbManager").getInstance();
var url = require("url");
var serviceStateBridge = require("../model/serviceStateBridge");

function handleRequest(req, res) {
    var queryString = req.body;
    rule = serviceStateBridge.newRule(queryString.ruleName, queryString.ruleType[0], queryString.ruleValue,
    									queryString.service_id, 0, new Date(), new Date());
    if (rule === undefined) {
        res.redirect('/viewServiceRules?service_id=' + queryString.service_id);
        return;
    }
	
    //Add rule with a callback to a reset of all rules which then calls back to redirect the request to the view rules page
    dbManager.addRule(rule,
    function() {
        serviceStateBridge.resetRules(function() {
            res.redirect('/viewServiceRules?service_id=' + queryString.service_id);
        });
    });

}

exports.handleRequest = handleRequest;