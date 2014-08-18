var url = require('url');
var CheckDisplays = require('../model/checkDisplays')
var serviceListener = require("../model/serviceListener");
var logger = require("../helpers/logger").getInstance();
var Checks = require("../model/checks");
var template = require("../model/template");

function handleRequest(req, res) {
    logger.error("viewCheck called");
    var queryString = url.parse(req.url, true).query;
    if (req.method === "POST") {
        queryString = req.body;
    }
    
    var healthCheck;
    var action;
    var title;
    var services = serviceListener.getServices();
    
	if (services.length != 0) {
        if (queryString.action === "add") {
            var Check = Checks.HealthCheck;
            healthCheck = new Check();
            healthCheck.init(0, '', queryString.service_id, '', 60, '', '', '', '', 300, new Date(), new Date(),'','','',"enabled");
            action = "add";
            title = "Adding";
        } else {
            dbHealthCheck = serviceListener.getHealthCheck(queryString.id, queryString.service_id);
            if (dbHealthCheck) {
                healthCheck = dbHealthCheck;
                if(typeof healthCheck.dynamic_config === "object"){
                    var temp = healthCheck.dynamic_config;
                    if(temp){
                        if(typeof temp === "object"){
                            temp = temp.sort();
                        }
                        healthCheck.dynamic_config = "";
                        for(var x in temp){
                            healthCheck.dynamic_config+=temp[x]+",\n";
                        }
                    }
                }
                action = "edit";
                title = "Editing"
            }
        }
        
        if (healthCheck === undefined) {
            logger.error("Could not create health check");
            res.redirect('/viewServiceChecks?service_id=' + queryString.service_id);
            return;
        }
    
        var service_name = "";
        
        var service = services[queryString.service_id];
        var service_name = undefined;
        if (service !== undefined) {
            service_name = service.name;
        }
        res.render("checks/viewCheck.jade", {
            check: healthCheck,
            title: "Health Dashboard - " + title + " Health Check",
            action: action,
            services: services,
            check_types: CheckDisplays.getAllHealthCheckDisplays(),
            json_check_types: JSON.stringify(CheckDisplays.getAllHealthCheckDisplays()),
            businessintelligence: healthCheck.businessintelligence,
            templates:template.getAllTemplatesSorted()
       });
    } else {
        // If there are no services, force the user to create one
        res.redirect("/viewService?action=add");
    }
}

exports.handleRequest = handleRequest;