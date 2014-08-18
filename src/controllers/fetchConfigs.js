var configFetcher = require("../helpers/configFetcher");
var serviceListener = require("../model/serviceListener");
var url = require('url');
var helpers = require("../helpers/helpers");

function handleRequest(req, res) {
    var queryString = req.body;
    var action = queryString.action;
    if(action == "service_groups"){
        configFetcher.getServiceGroups(function(err,results){
            if(err){
                console.log(err);
            }
            res.send(JSON.stringify(results));
            res.end();
        });
    }
    else if(action == "db_config"){
        var hostgroup;
        if(queryString.hostgroup){
            hostgroup = queryString.hostgroup;
        }
        else{
            hostgroup = "All";
        }
        
        configFetcher.getAppConfigFromDbServer("db_config:"+hostgroup, function(err,results){
            if(err){
                console.log(err);
            }
            res.send(JSON.stringify(results));
            res.end();
        });
    }
    else if(action == "dependent_checks"){
        var healhChecks = serviceListener.getAllHealthChecks();
        var result = {};
        var check_id = queryString.check_id;
        for(var x in healhChecks){
            if(!result[x]){
                result[x] = [];
            }
            for(var y in healhChecks[x]){
                if(!(healhChecks[x][y].id == check_id)){
                    result[x].push(new DependentCheckDisplay(healhChecks[x][y].id, healhChecks[x][y].name));
                }
            }
            result[x].sort(sortHealthChecksByName);
        }
        res.send(result);
        res.end();
    }
    else if(action == "app_configs"){
        var services = serviceListener.getServices();
        var service = services[queryString.service_id];
        configFetcher.getConfigFromAppServer("app_config:"+service.app_server+":"+service.app_server_url, null, function(err,results){
            if(err){
                console.log("APP_CONFIG ERROR " + err);
            }
            var flatResults = helpers.flattenJsonObject(results);
            var generatedResults = {};
            var flatResult;
            for(var x in flatResults){
                flatResult = flatResults[x];
                if(!generatedResults[x]){
                    generatedResults[x] = [];
                }
                for(var y in flatResult){
                    generatedResults[x].push(flatResult[y][0] + ":" + flatResult[y][1]);
                }
                generatedResults[x].sort();
            }
            res.send(generatedResults);
            res.end();
        });
    }
}

function DependentCheckDisplay(id, name){
    this.id = id;
    this.name = name;
}
function sortHealthChecksByName(h1, h2) {
    
    return compare(h1.name, h2.name);
}

function compare(s1, s2) {
    if (s1 == s2) {
        return 0;
    } else if (s1 > s2) {
        return 1;
    }
    return -1;
}

exports.handleRequest = handleRequest;