var dbManager = require("../db/dbManager").getInstance();
var serviceStateBridge = require("../model/serviceStateBridge");

function handleRequest(req, res) {
    var params = req.body;
    //Delete rule with a callback to a reset of all rules which then calls back to redirect the request to the view rules page
    dbManager.deleteRule(params.id,
    function() {
        serviceStateBridge.resetRules(function() {
            res.redirect('/viewServiceRules?service_id=' + params.service_id);
        });
    });

}

exports.handleRequest = handleRequest;