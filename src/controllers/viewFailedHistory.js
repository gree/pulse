var url = require("url");
var serviceListener = require("../model/serviceListener");
var helpers = require("../helpers/helpers");
var logger = require("../helpers/logger").getInstance();
var historyFetcher = require("../helpers/historyFetcher");

function handleRequest(req, res) {
    if (req.method === "GET") {
        query = url.parse(req.url, true).query;
    } else if (req.method === "POST") {
        query = req.body;
    }
    var limit = query.limit !== undefined ? query.limit : 21;
    var page = query.page !== undefined ? query.page : 0;
    var offset = page * (limit-1);
    
    var serviceHistory = historyFetcher.getFailedHistory(limit, offset, 
        function (serviceHistory, hasNext) {

            var service_name = "All"; // Service name can refer to the service name or check name
            
            for (var index in serviceHistory) {
                serviceHistory[index].short_details = helpers.shortenString(serviceHistory[index].details);
                serviceHistory[index].formattedLastReceived = helpers.formatDateString(serviceHistory[index].lastReceived);
                if (query.service_id) {
                    // If query.service_id is set, we are looking at the history of one service
                    service_name = serviceHistory[index].service_name;
                    if (query.check_id) {
                        service_name = serviceHistory[index].name; 
                    }
                }
                
            }
            
            res.render("failedHistory.jade", {
                serviceStates: serviceHistory,
                hasNext: hasNext,
                page: page,
                service_id: query.service_id,
                check_id: query.check_id,
                stateStatus: query.state,
                title: "Health Dashboard - Failed History - " + service_name,
                history: true,
                service_name: service_name,
                referrer:"",
                services:serviceListener.getServices()
                });
        });
} 





exports.handleRequest = handleRequest;