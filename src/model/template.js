var util = require("util");
var dbManager = require("../db/dbManager").getInstance();
var serviceListener = require("./serviceListener");
var sprintf = require('sprintf').sprintf;
var sorters = require("../helpers/sorters");

var templates = {};
var parameterFunctions = {};

var parameters = {};
parameters["HEALTHCHECK_NAME"] = "HEALTHCHECK_NAME";
parameters["SERVICE_NAME"] = "SERVICE_NAME";
parameters["ERRORS"] = "ERRORS";
parameters["LINK_TO_HEALTH_CHECK"] = "LINK_TO_HEALTH_CHECK";
parameters["LINK_TO_SERVICE"] = "LINK_TO_SERVICE";


function Template(){}

Template.prototype.init = function(id, type, name, subject, body, timeCreated, timeModified){
    this.id = id;
    this.type = type;
    this.name = name;
    this.subject = subject;
    this.body = body;
    this.timeCreated = timeCreated;
    this.timeModified = timeModified;
};

Template.prototype.addTemplateToDb = function(callback){
    var template = this;
    dbManager.addTemplate(template, function(err,results,fields) {
        template.id = results.insertId;
        templates[template.id] = template;
        if(callback){
            callback();
        }
    });
};

Template.prototype.editTemplate = function(callback){
    dbManager.editTemplate(this, function(err,results,fields) {
        if(callback){
            callback();
        }
    });
};

function getAllTemplates(){
    return templates;
}

function getAllTemplatesSorted(){
    var sortedTemplates = [];
    for(var x in templates){
        sortedTemplates.push(templates[x]);
    }
    
    return sortedTemplates.sort(sorters.sortTemplatesForDisplay);
}

function getTemplate(template_id){
    return templates[template_id];
}

function addTemplate(template){
    templates[template.id] = template;
}

function getParameters(){
    return parameters;
}
function EmailTemplate(){}

util.inherits(EmailTemplate, Template);

function SmsTemplate(){}

util.inherits(SmsTemplate, Template);

parameterFunctions["HEALTHCHECK_NAME"] = function(healthCheckState){
    var healthCheck = healthCheckState.healthCheck;
    return healthCheck.name;
};

parameterFunctions["SERVICE_NAME"] = function(healthCheckState){
    var healthCheck = healthCheckState.healthCheck;
    var serviceName = serviceListener.getServiceName(healthCheck.service_id);
    return serviceName;
};

parameterFunctions["LINK_TO_HEALTH_CHECK"] = function(healthCheckState,template_type){
    var healthCheck = healthCheckState.healthCheck;
    var url = 'http://localhost/viewCheck?service_id='+healthCheck.service_id+'&id='+healthCheck.id;
    if(template_type == "EmailTemplate"){
        var link = '<a href="' + url + '">Health Check</a>';
        return link;
    }
    return url;
};

parameterFunctions["LINK_TO_SERVICE"] = function(healthCheckState,template_type){
    var healthCheck = healthCheckState.healthCheck;
    var url = 'http://localhost/viewServiceChecks?service_id='+healthCheck.service_id;
    if(template_type == "EmailTemplate"){
        var link = '<a href="' + url + '">Service Checks</a>';
        return link;
    }
    return url;
};

parameterFunctions["ERRORS"] = function(healthCheckState,template_type){
    if(template_type == "SmsTemplate"){
        var errors = "";
        for(var key in healthCheckState.details) {
            errors += healthCheckState.healthCheck.getServerDisplayName(key) + " ,";
            return errors;
        }
    }
    
    var errors = "";
    errors += '<table>';
    errors += '<tr><td>Server name</td><td>Error Details</td></tr>';
    for(var key in healthCheckState.details) {
        errors += sprintf('<tr><td>%s</td><td>%s</td></tr>', healthCheckState.healthCheck.getServerDisplayName(key), healthCheckState.details[key]);
    }
    errors += '</table>';
    return errors;
};

var TemplateTypes = {
        'Template'         :  Template,
        'EmailTemplate'   : EmailTemplate,
        'SmsTemplate' : SmsTemplate,
};

for (var index in TemplateTypes) {
    exports[index] = TemplateTypes[index];
}

exports.TemplateTypes = TemplateTypes;
exports.getAllTemplates = getAllTemplates;
exports.getAllTemplatesSorted = getAllTemplatesSorted;
exports.getTemplate = getTemplate;
exports.addTemplate = addTemplate;
exports.parameterFunctions = parameterFunctions;
exports.getParameters = getParameters;

