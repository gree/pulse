var dbManager = require("../db/dbManager").getInstance();
var url = require("url");
var serviceStateBridge = require("../model/serviceStateBridge");

function handleRequest(req, res) {
    var queryString = req.body;
    rule = serviceStateBridge.newRule(queryString.ruleName, queryString.ruleType, queryString.ruleValue,
    queryString.service_id, queryString.id, queryString.timeCreated, new Date());
    if (rule === undefined) {
        res.redirect('/viewServiceRules?service_id=' + queryString.service_id);
        return;
    }
    //Edit rule with a callback to a reset of all rules which then calls back to redirect the request to the view rules page
    dbManager.editRule(rule,
    function() {
        serviceStateBridge.resetRules(function() {
            res.redirect('/viewServiceRules?service_id=' + queryString.service_id);
        });
    });

}

exports.handleRequest = handleRequest;