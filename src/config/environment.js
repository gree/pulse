var logger = require("../helpers/logger").getInstance();
var dev = require('../../config/dev.js');
var prod = require('../../config/prod.js');
var instance = null;
var env;

function Environment(){
    
}

Environment.prototype.loadEnvironment = function(env,callback){

    if(env == "dev"){
        env = dev;
    }
    else if(env == "prod"){
        env = prod;
    }
    instance.setEnvironmentVariables(env.configs, function(){
        if(callback){
            callback();
        }
    });
}

Environment.prototype.setEnvironmentVariables = function(environment,callback){
    // set mysql env variables
    
    for(var x in environment){
        this[x] = environment[x];
    }
    
    if(callback){
        callback();
    }
    
}

Environment.prototype.getPulseDbDetails = function(callback){
    callback(this.pulse_db);
}

Environment.prototype.getMegatronDbDetails = function(callback){
    callback(this.megatron_db);
}

function getInstance(){
    if(!instance){
        instance = new Environment();
    }

    return instance;
}

exports.getInstance = getInstance;