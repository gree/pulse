var http = require("http");
var logger = require("../helpers/logger").getInstance();
var Client = require('mysql').Client;
var environment = require("../config/environment").getInstance();
var helpers = require("./helpers");
var request = require("request");

var configFunctions = {};
var defaultMysqlHost;
var defaultMysqlPort;
var defaultMysqlDb = "megatron";
var defaultMysqlUser;
var defaultMySqlPassword;
var defaultMySqlTable = "deploy_hosts";
var defaultMySqlField = "hostname";
var defaultMySqlWhereField = "hostgroup";

var serviceGroups; 
var db_config;
var MEGATRON_PULL_PERIOD = 60000;  // reduced to better keep up with auto-scaling
var megatronPull = setTimeout(pullFromMegatron, MEGATRON_PULL_PERIOD);

environment.getMegatronDbDetails(function(megatronDbDetails){
    defaultMysqlHost = megatronDbDetails["host"];
    defaultMysqlPort = megatronDbDetails["port"];
    defaultMysqlUser = megatronDbDetails["user"];
    defaultMySqlPassword = megatronDbDetails["password"];
});

configFunctions["DatabaseHealthCheck"] = function(configSplit,configData,callback){
    var properties = [];
    var configStrings = [];
    var port;
    var user;
    if(configSplit && configSplit.length > 0){
        if(configSplit.length >= 6){
            properties = configSplit[3].split(".");
            port = configSplit[4];
            user = configSplit[5];
        }
        else{
            if(callback){
                callback("APP_CONFIG_ERROR -- Too Few parameters ", null);
                return;
            }
        }

        var configs = helpers.traceToAKey(configData,properties);
        if(!configs){
            if(callback)
                callback("APP_CONFIG_ERROR -- Invalid Property " + configSplit[3] ,null);
            return;
        }
        var flattenedConfigs = helpers.flattenJsonObject(configs);
        var config = "";
        for(var x in flattenedConfigs){
            var flattenedConfig = flattenedConfigs[x];
            for(var y in flattenedConfig){
                if(flattenedConfig[y].length >= 2 ){
                    config+=flattenedConfig[y][0] + ":"; //db host
                    config+=port + ":";
                    config+=flattenedConfig[y][1] + ":";//db name
                    config+=user;
                    configStrings.push(config);
                    config = "";
                }
            }
        }
        if(callback)
            callback(null,configStrings);
    }
};

configFunctions["MemcacheHealthCheck"] = function (configSplit,configData,callback){
    var properties = [];
    var configStrings = [];
    if(configSplit && configSplit.length > 0){
        if(configSplit.length >= 4){
            properties = configSplit[3].split(".");
        }
        else{
            if(callback){
                callback("APP_CONFIG_ERROR -- Too Few parameters ", null);
                return;
            }
        }
        
        var configs = helpers.traceToAKey(configData,properties);
        if(!configs){
            if(callback)
                callback("APP_CONFIG_ERROR -- Invalid Property " + configSplit[3] ,null);
            return;
        }
        var flattenedConfigs = helpers.flattenJsonObject(configs);
        var config = "";
        for(var x in flattenedConfigs){
            var flattenedConfig = flattenedConfigs[x];
            for(var y in flattenedConfig){
                if(flattenedConfig[y].length >= 2 ){
                    config+=flattenedConfig[y][0] + ":"; //mem host
                    config+=flattenedConfig[y][1]; //mem port
                    configStrings.push(config);
                    config = "";
                }
            }
        }
        if(callback)
            callback(null,configStrings);
    }
};

function getConfigFromAppServer(configString, check_type, callback){
    if(!configString){
        if(callback)
            callback("APP_CONFIG_ERROR -- No config String ",null,configString);
        return;
    }
    
    if(configString.indexOf("app_config") == -1){
        if(callback)
            callback("APP_CONFIG_ERROR -- Not a Valid app_config " + configString,null,configString);
        return;
    }
    
    var configSplit = configString.split(":");
    
    if(!configSplit){
        if(callback)
            callback("APP_CONFIG_ERROR -- Not a Valid app_config " + configString,null,configString);
        return;
    }
    
    if(configSplit.length < 3){
        if(callback)
            callback("APP_CONFIG_ERROR -- Not Enough Parameters " + configString, null,configString);
        return;
    }
    
    if(configSplit[2].indexOf("/") == -1){
        if(callback)
            callback("APP_CONFIG_ERROR -- Invalid URL " + configSplit[1] + configSplit[2], null,configString);
        return;
    }
    var server = configSplit[1];
    var path = configSplit[2];
    
    request("http://"+server+path, function (error, response, body) {
        if(error){
            if(callback){
                callback("APP_CONFIG_ERROR - connecting to server " + server + path + " " + error, null,configString);
            }
            return;
        }
        if (response.statusCode !== 200) {
            if(callback){
                callback("APP_CONFIG_ERROR -- invalid response from: " + server + " status code: " + response.statusCode,configString);
                return;
            }
        }
        var data;
        try{
            data = JSON.parse(body);
        }catch(e){
            callback("APP_CONFIG_ERROR -- Error receiving data from server " + e, null,configString);
            return;
        }
        if(data && data["error"] === undefined){
            if(check_type){
                if(configFunctions[check_type] !== undefined){
                    configFunctions[check_type](configSplit,data,function(err, configStrings){
                        if(callback){
                            callback(err, configStrings,configString);
                            return;
                        }
                    });
                }
            }
            else{
                callback(null, data);
                return;
            }
        }
        else{
            var error;
            if(data){
                error = data["error"];
            }
            else{
                error = data;
            }
            if(callback){
                callback("APP_CONFIG_ERROR -- Error receiving data from server " + error, null,configString);
                return;
            }
        }
    });
}

function pullAppConfigFromDbServer(configString, callback){
    if(!configString){
        if(callback)
            callback("DB_CONFIG_ERROR -- No config String ",null,configString);
        return;
    }
    
    if(configString.indexOf("db_config") == -1){
        if(callback)
            callback("DB_CONFIG_ERROR -- Not a Valid db_config " + configString,null,configString);
        return;
    }
    
    var configSplit = configString.split(":");
    
    if(!configSplit){
        if(callback)
            callback("DB_CONFIG_ERROR -- Not a Valid db_config " + configString,null,configString);
        return;
    }
    
    if(configSplit.length < 2){
        if(callback)
            callback("DB_CONFIG_ERROR -- Only 2 parameters allowed " + configString, null,configString);
        return;
    }
    
    var configStrings = {};
    var host = defaultMysqlHost;
    var port = defaultMysqlPort;
    var database = defaultMysqlDb;
    var user = defaultMysqlUser;
    var password = defaultMySqlPassword;
    var field = defaultMySqlField;
    var whereField = defaultMySqlWhereField;
    var table = defaultMySqlTable;
    var whereValue;
    var query;
    if(configSplit[1] != "All"){
        whereValue = configSplit[1];
        query = "SELECT " + field + " , " + whereField + " FROM " + table + " WHERE " 
                + whereField + " = " + "\""+whereValue+"\"" + " AND " + field + " LIKE \"app-%\"" + " ORDER BY " + field;
    }
    else{
        query = "SELECT " + field + " , " + whereField + " FROM " + table + " WHERE " + field + " LIKE \"app-%\"" + " ORDER BY " + field;
    }
    var client = new Client();
    client.host = host;
    client.port = port;
    client.database = database;
    client.user = user;
    if(password != "")
        client.password = password;
    client.on('error', function(err) {
        client.destroy();
        client._queue = [];
        if(callback){
            callback("DB_CONFIG_ERROR -- " + err, null,configString);
            return;
        }
    });
    client.query(query, function(err, results, fields) {
        if(err){
            if(callback)
                callback("DB_CONFIG_ERROR " + err, null, configString);
        }
        else{
            if(results && results.length != 0){
                for(x in results){
                    if(!configStrings[results[x][whereField]]){
                        configStrings[results[x][whereField]] = [];
                    }
                    configStrings[results[x][whereField]].push(results[x][field]);
                }
                if(callback){
                    callback(null,configStrings,configString);
                }
            }
            else{
                if(callback)
                    callback("DB_CONFIG_ERROR -- Query returns empty set with " + whereField + " = " + whereValue,configString);
            }
        }
        client.end();
    });
}

function getServiceGroups(callback){
    if(!serviceGroups){
        pullServiceGroups(function(error, results){
            serviceGroups = results;
            callback(null, results);
        });
    }
    else{
        callback(null, serviceGroups);
    }
}

function getAppConfigFromDbServer(configString, callback){
    if(!db_config){
        pullAppConfigFromDbServer("db_config:All", function(error, results){
            db_config = results;
            var configSplit = configString.split(":");
            if(configSplit[1] == "All"){
                callback(null, db_config);
            }
            else{
                var returnValue = {};
                returnValue[configSplit[1]] = db_config[configSplit[1]];
                callback(null, returnValue);
            }
            
        });
    }
    else{
        var configSplit = configString.split(":");
        if(!configSplit){
            if(callback)
                callback("DB_CONFIG_ERROR -- Not a Valid db_config " + configString,null,configString);
            return;
        }
        
        if(configSplit.length < 2){
            if(callback)
                callback("DB_CONFIG_ERROR -- Only 2 parameters allowed " + configString, null,configString);
            return;
        }
        if(configSplit[1] == "All"){
            callback(null, db_config);
        }
        else{
            var returnValue = {};
            returnValue[configSplit[1]] = db_config[configSplit[1]];
            callback(null, returnValue);
        }
    }
}

function pullServiceGroups(callback){
    var client = new Client()
    client.host = defaultMysqlHost;
    client.port = defaultMysqlPort;
    client.database = defaultMysqlDb;
    client.user = defaultMysqlUser;
    if(defaultMySqlPassword != "")
        client.password = defaultMySqlPassword;
    client.on('error', function(err) {
        client.destroy();
        client._queue = [];
        if(callback){
            callback("DB_CONFIG_ERROR -- " + err, null);
            return;
        }
    });
    
    var query = "SELECT DISTINCT( "+ defaultMySqlWhereField + " ) from " + defaultMySqlTable + " ORDER BY " + defaultMySqlWhereField;
    var service_groups = [];
    client.query(query, function(err, results, fields) {
        if(err){
            if(callback)
                callback("DB_CONFIG_ERROR " + err, null);
        }
        else{
            if(results && results.length != 0){
                for(x in results){
                    service_groups.push(results[x][defaultMySqlWhereField]);
                }
                if(callback){
                    callback(null,service_groups);
                }
            }
            else{
                if(callback)
                    callback("DB_CONFIG_ERROR -- Query returns empty set with",null);
            }
        }
        client.end();
    });
}

function pullFromMegatron(){
    megatronPull = setTimeout(pullFromMegatron, MEGATRON_PULL_PERIOD);
    pullServiceGroups(function(error, results){
        if(!error){
            if(results){
                serviceGroups = results;
            }
        }
        
        pullAppConfigFromDbServer("db_config:All", function(error, results){
            if(!error){
                if(results){
                    db_config = results;
                }
            }
        });
    });
}

exports.getConfigFromAppServer = getConfigFromAppServer;
exports.getAppConfigFromDbServer = getAppConfigFromDbServer;
exports.getServiceGroups = getServiceGroups;
