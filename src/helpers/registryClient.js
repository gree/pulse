var logger = require('./logger').getInstance();
var request = require('request');

var RETRY_INTERVAL = 30000;

var regServerConfig = {
		address: '',
		port: 10000,
		regPath: '/service_registry'
	};


function getGroupName(properties, hostName) {

	// check if it's defined in payload
	if (properties['service_group'] != undefined){
		return properties['service_group'];
	}
	
	// use the hostname prefix as the group name
	// remove the number part
	var groupName = hostName;
	var lastIndex = hostName.lastIndexOf('-');
	if (lastIndex > 0){
		var serverNumber = hostName.substr(lastIndex + 1);
		if (!isNaN(serverNumber)){
			groupName = hostName.substring(0, lastIndex);
		}
	}
	return groupName;
}

function buildProperties(defaultProperties) {
	
	var props= defaultProperties==undefined ? {} : defaultProperties;

	for (var i = 0; i < process.argv.length; i++) {
	    var arg = process.argv[i];
	    
	    if (arg.lastIndexOf("-", 0) == 0) {
	    	// starts with "-"
	    	var key = arg.substr(1, arg.length - 1);
	    	var value = process.argv[++i];
            props[key] = value;
	    }
	}
	
	return props;
	
}

function buildHttpParameters(serviceInfo, properties) {

	var parameters = "?";
	for(var field in serviceInfo) {
		parameters += field + "=" + serviceInfo[field] + "&";
	}
	
    for(var field in properties) {
    	if (serviceInfo[field] == undefined) {
			parameters += field + "=" + properties[field] + "&";
    	}
	}

	parameters= encodeURI(parameters);
	
	return parameters;
	
}

function registerServiceStart(defaultProperties, serviceName) {

	var properties= buildProperties(defaultProperties);
	
	var hostName = require('os').hostname();

	var serviceInfo = {
			service_group: getGroupName(properties, hostName),
			service_name: properties['service_name'] != undefined ? properties['service_name'] : serviceName,
			env: properties['env']!=undefined ? properties['env'] : 'prod',
			process_id: process.pid,
			host_name: hostName
	}
	
	if (serviceInfo.service_name == undefined) {
		logger.info("Service name is unknown");
		serviceInfo.service_name = 'Unkown Service';
	}
	
	var parameters = buildHttpParameters(serviceInfo, properties);
	
	var serviceRegServer = {
		host: serviceInfo.env == 'prod' ? regServerConfig.address : '127.0.0.1',
		port: regServerConfig.port,
		path: regServerConfig.regPath + parameters,
		method: 'GET'
	};
	
	var url = 'http://' + serviceRegServer.host + ':' + serviceRegServer.port + serviceRegServer.path;
	
	
	var cbRetry = function(error, response, body) {
		if (error) {
			logger.info(error); 
			setTimeout(function() {
				request(url, cbRetry);
			}, RETRY_INTERVAL);
			logger.info('try again after ' + RETRY_INTERVAL/1000 + ' seconds');
		}  else {
			logger.info('service registered!');
		}
		
	}
	
	request(url, cbRetry);
	
}

exports.registerServiceStart = registerServiceStart;
