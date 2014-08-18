var logger = require("../helpers/logger").getInstance();
var verticaQuery = require("../model/verticaQuery");

function handleRequest(req, res) {
    logger.debug("isValidVerticaQuery called " + req.method);
    
    if (req.method != "POST") {
        logger.error("WARN: isValidVerticaQuery called as " + req.method + " request.");
        res.end();
        return;
    } 
    
    var queryString = req.body;
    var action = queryString.action;
    if (action === undefined) {
        logger.error("No action specified for editCheck.");
        res.end();
        return;
    } else if (action == "processQuery") {
        logger.debug("Action = " + action + " DBString: "+queryString.dbConnectionString+" Query: '"+queryString.query+"'");
        //vertQ.runQuery(queryString.dbConnectionString, queryString.query);
        var out = verticaQuery.runVerticaQuery(queryString.dbConnectionString, queryString.query, function(output, result){
            // this is coz the view expects success when there are no errors.
            if(!output){
                output = "success";
            }
            logger.error("Output: "+output);
            res.send(output);
            res.end();
        });
        return;
    }
}

exports.handleRequest = handleRequest;