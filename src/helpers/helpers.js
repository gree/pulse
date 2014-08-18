var dateFormat = require('dateformat');
var Templates = require('../model/template');
var serviceListener = require('../model/serviceListener');
var sprintf = require('sprintf').sprintf;
var logger = require('./logger').getInstance();
/**
 *   Helper functions
 *
 */


/**
 * Converts a database datetime into a more readable string
 */
function formatDateString(datetime) {
    return dateFormat(datetime, "mm-dd-yy HH:MM:ss");
}


/**
 * Converts seconds into a more human readable form
 */
function getIntervalString(interval) {
    if (interval > 60) {
        var minutes = Math.floor(interval / 60);
        var seconds = interval % 60;
        var output = minutes + "m";
        if (seconds > 0) {
            output = output + " " + seconds + "s"
        }
        return output;
    } else {
        return interval + " s";
    }
}


/**
 *  Shortens a string to a specified length
 */
function shortenString(text, length){
    if (length === undefined) {
        length = 60;
    }
    // First only grab up to first new line
    var shortened_text = text.split(/\r\n|\r|\n/)[0];
    shortened_text = shortened_text.split("<br>")[0];
    shortened_text = shortened_text.split("<br />")[0];
    // Then, limit to length characters.
    if (shortened_text.length > length) { 
        shortened_text = shortened_text.substring(0, length - 3) + "...";
    }
    return shortened_text;
}


/**
 *  Changes a health check property into human readable form
 */
function getDisplayProperty(property) {    
    property = property.replace(/(\r\n|\n|\r)/gm, "<br>");
    property = property.replace(/\s+/g, "");
    return property;

}


/**
 *   Checks if a value is in an array
 */
function inArray(value, array) {
    var arrayDictionary = {};
    for (var i in array) {
        arrayDictionary[array[i]] = '';
    }
    
    return value in arrayDictionary;
}

/**
 * Flattens a nested json object to assign all the values to the top level keys,
 * handles nested objects as well as nested arrays
 */

function flattenJsonObject(nestedJsonObject){
    if(!nestedJsonObject){
        return null;
    }
    var stack = [];
    var temp;
    var flatJsonObject = {};
    for(var key in nestedJsonObject){
        stack.push(nestedJsonObject[key]);
        while(stack.length != 0){
            temp = stack.pop();
            if(temp.length === undefined){ // means its a json and not an array
                for(x in temp){
                    stack.push(temp[x]);
                }
            }
            else{
                if(temp.length > 0){
                    if(typeof temp[0] === "object"){ // means its a nested array
                        for(x in temp){
                            stack.push(temp[x]);
                        }
                    }
                    else{
                        if(!flatJsonObject[key]){
                            flatJsonObject[key] = [];
                        }
                        flatJsonObject[key].push(temp);
                    }
                }
            }
        }
    }
    
    return flatJsonObject;
}

/**
 * parses a nested json object and finds a key and its value specified by some trace.
 * NOTE: it only looks for the key in a particular trace and not the entire object
 */
function traceToAKey(jsonObject, tracePath){
    
    if(!jsonObject || !tracePath || !tracePath.length){
        return null;
    }
    
    var i = 0;
    var tracedObject = jsonObject;
    while(i<tracePath.length){
        if(tracedObject !== undefined){
            tracedObject = tracedObject[tracePath[i]];
            i++;
        }
        else{
            break;
        }
    }
    return tracedObject;
}

function getParameter(parameter, healthCheckState){
    var healthCheck = healthCheckState.healthCheck;
    if(parameter == "HealthCheck Name"){
        return healthCheck.name;
    }
    if(parameter == "Service Name"){
        var serviceName = serviceListener.getServiceName(healthCheck.service_id);
        return serviceName;
    }
    if(parameter == "Errors"){
        var errors = "";
        errors += '<table>';
        errors += '<tr><td>Server name</td><td>Error Details</td></tr>';
        for(var key in healthCheckState.details) {
            errors += sprintf('<tr><td>%s</td><td>%s</td></tr>', key, healthCheckState.details[key]);
        }
        errors += '</table>';
        return errors;
    }
    if(parameter == "Link to Service"){
        var link = '<a href="http://localhost:3000/viewServiceChecks?service_id='+healthCheck.service_id+'">Service Checks</a>';
        return link;
    }
    if(parameter == "Link to HealthCheck"){
        var link = '<a href="http://localhost:3000/viewCheck?service_id='+healthCheck.service_id+'&id='+healthCheck.id+'">Health Check</a>';
        return link;
    }
}

function buildSubjectFromTemplate(template, healthCheckState){
    if(!template || !healthCheckState){
        logger.error("Need all 2 parameters to build subject");
        return "";
    }

    email_template = template.subject;
    var body = "";
    var i =0;
    var char;
    var parameter;
    while(i<email_template.length){
        char = email_template[i];
        if(char == '{'){
            i++;
            parameter = "";
            while(i<email_template.length && email_template[i] != '}'){
                char = email_template[i];
                parameter+=char;
                i++;
            }
            parameter = parameter.trim();
            if(Templates.parameterFunctions[parameter]){
                parameter = Templates.parameterFunctions[parameter](healthCheckState);
                body+=parameter;
            }
            else{
                body+=" { " + parameter + " } ";
            }
        }
        else if(char == '\n'){
            body+="    ";
        }
        else if(char == '\t'){
            body+="    ";
        }
        else{
            body+=char;
        }
        i++;
    }
    body += "";
    return body;
}

function buildBodyFromTemplate(template, healthCheckState, template_type){
    if(!template || !healthCheckState || !template_type){
        logger.error("Need all 3 parameters to build body");
        return "";
    }

    email_template = template.body;
    var body = "";
    var i =0;
    var char;
    var parameter;
    while(i<email_template.length){
        char = email_template[i];
        if(char == '{'){
            i++;
            parameter = "";
            while(i<email_template.length && email_template[i] != '}'){
                char = email_template[i];
                parameter+=char;
                i++;
            }
            parameter = parameter.trim();
            if(Templates.parameterFunctions[parameter]){
                parameter = Templates.parameterFunctions[parameter](healthCheckState, template_type);
                body+=parameter;
            }
            else{
                body+=" { " + parameter + " } ";
            }
        }
        else if(char == '\n'){
            body+="<br>";
        }
        else if(char == '\t'){
            body+="&nbsp;&nbsp;&nbsp;&nbsp;";
        }
        else{
            body+=char;
        }
        i++;
    }
    body += "";
    return body;
}

function addEpochToVerticaQuery(query){
    if(query.toUpperCase().indexOf("SELECT") != -1){
        if(query.toUpperCase().indexOf("AT EPOCH LATEST") == -1){
            query = "AT EPOCH LATEST " + query;
        }
    }
    return query;
}

exports.formatDateString = formatDateString;
exports.getIntervalString = getIntervalString;
exports.shortenString = shortenString;
exports.getDisplayProperty = getDisplayProperty;
exports.inArray = inArray;
exports.flattenJsonObject = flattenJsonObject;
exports.traceToAKey = traceToAKey;
exports.buildBodyFromTemplate = buildBodyFromTemplate;
exports.buildSubjectFromTemplate = buildSubjectFromTemplate;
exports.addEpochToVerticaQuery = addEpochToVerticaQuery;