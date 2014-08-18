var Email = require('../helpers/email');
var Sms = require('../helpers/sms');
var serviceListener = require("./serviceListener");
var dateFormat = require('dateformat');
var StateEnum = require("./rules").StateEnum;
var logger = require("../helpers/logger").getInstance();
var helpers = require("../helpers/helpers");
var notificationDelay = 300 * 1000;
var sprintf = require('sprintf').sprintf;
var checks = require("../model/checks");
var Templates = require("./template");

function HealthCheckState(healthCheck, stateId) {
    this.state = StateEnum.PROCESSING;
    this.healthCheck = healthCheck;
    this.lastReceived = new Date();
    this.details = {};
    this.stateId = stateId;
    this.requests = {};
    this.requestsCount = 0;
}

HealthCheckState.prototype.addDetail = function(name, error) {
    this.details[name] = error;
    if (this.getErrorCount() > 0) {
        this.setState(StateEnum.ERROR);
    }
}

HealthCheckState.prototype.getErrorCount = function() {
    return Object.keys(this.details).length;
}

HealthCheckState.prototype.removeDetail = function(name) {
    if(name in this.details){
        delete(this.details[name]);
    }
    if (this.getErrorCount() === 0) {
        this.setState(StateEnum.HEALTHY);
    }
}

HealthCheckState.prototype.setDetails = function(details) {
    for (var key in details) {
        //todo check if the server exist
        this.details[key] = details[key];
    }
}

HealthCheckState.prototype.setState = function(state) {
    var delay = this.healthCheck.notificationDelay * 1000;
    if (delay == 0) {
        delay = notificationDelay;
    }
    if (this.state != state) {
        if (state == StateEnum.ERROR) {
            if (!this.healthCheck.failingSince) {
                this.healthCheck.failingSince = new Date();
            }
            logger.info('sending email due to state change to failing');
            delaySendNotification(this, delay);
        } else if (state == StateEnum.HEALTHY && this.state == StateEnum.ERROR){
            var curTime = new Date().getTime();
            var cutoff = curTime - delay;
            if (this.healthCheck.failingSince && this.healthCheck.failingSince.getTime() < cutoff) {
                delaySendNotification(this, 65000);
                logger.info('sending email due to state change to passing');
            }
            this.healthCheck.failingSince = null;
        }
        this.state = state;
    }
}

HealthCheckState.prototype.getNotificationDetails = function(state) {
    var template;
    if(this.healthCheck.email_template && this.healthCheck.email_template != "" && this.healthCheck.email_template != 0 && state){
        template = Templates.getTemplate(this.healthCheck.email_template);
    }
    var serviceName = serviceListener.getServiceName(this.healthCheck.service_id);
    logger.info("State before sending the email : " + state);
    var subject = 'Service ' + serviceName + ' - ' + this.healthCheck.name + ' is ' + (state ? ' failing' : 'passing ');
    if(template){
        subject = helpers.buildSubjectFromTemplate(template, this);
    }
    var body = subject;
    if (this.state == StateEnum.ERROR) {
            body += '<table>';
            body += '<tr><td>Server name</td><td>Error Details</td></tr>';
            for(var key in this.details) {
                body += sprintf('<tr><td>%s</td><td>%s</td></tr>', this.healthCheck.getServerDisplayName(key), this.details[key]);
            }
            body += '</table>';
    }
    if(template){
        body = helpers.buildBodyFromTemplate(template, this, "EmailTemplate");
    }
    //body += (" Sent at " + dateFormat(new Date(), 'mm-dd HH:MM:ss'));
    return {subject: subject, body: body};
}


HealthCheckState.prototype.getDisplayDetails = function(state) {
    var serviceName = serviceListener.getServiceName(this.healthCheck.service_id);
    var body = '';
    if (this.state == StateEnum.ERROR) {
        for(var key in this.details) {
            body += sprintf('%s errors: %s <br/>', this.healthCheck.getServerDisplayName(key), this.details[key]);
        }
    }
    return body;
}


HealthCheckState.prototype.getSmsDetails = function() {
    var template;
    if(this.healthCheck.sms_template && this.healthCheck.sms_template != "" && this.healthCheck.sms_template != 0 && this.state){
        template = Templates.getTemplate(this.healthCheck.sms_template);
    }
    var serviceName = serviceListener.getServiceName(this.healthCheck.service_id);
    var subject = 'Service ' + serviceName + ' - ' + this.healthCheck.name + ' is ' + (this.state ? ' failing' : 'passing ');
    var body = subject;
    body += " - http:// - ";
    for(var key in this.details) {
        body += this.healthCheck.getServerDisplayName(key) + ', ';
    }
    if(template){
        body = helpers.buildBodyFromTemplate(template, this, "SmsTemplate");
    }

    return body;
}

HealthCheckState.prototype.getEmailDetails = function() {
    var template;
    if(this.healthCheck.email_template && this.healthCheck.email_template != "" && this.healthCheck.email_template != 0 && this.state){
        template = Templates.getTemplate(this.healthCheck.email_template);
    }
    var serviceName = serviceListener.getServiceName(this.healthCheck.service_id);
    var subject = 'Service ' + serviceName + ' - ' + this.healthCheck.name + ' is ' + (this.state ? ' failing' : 'passing ');
    if(template){
        subject = helpers.buildSubjectFromTemplate(template, this);
    }
    
    var body = subject + '<br/>';
    if (this.state == StateEnum.ERROR) {
        body += '<table>';
        body += '<tr><td>Server name</td><td>Error Details</td></tr>';
        for(var key in this.details) {
            body += sprintf('<tr><td>%s</td><td>%s</td></tr>', this.healthCheck.getServerDisplayName(key), this.details[key]);
        }
        body += '</table>';
    }
    body += '<br/>'
    body += 'Please visit <a href="http://localhost">Pulse</a> for more information';
    if(template){
        body = helpers.buildBodyFromTemplate(template, this, "EmailTemplate");
    }
    return body;
}


HealthCheckState.prototype.startRequest = function(name) {
    this.requests[name] = false;
    this.requestsCount++;
}

HealthCheckState.prototype.endRequest = function(name) {
    this.requests[name] = true;
    this.requestsCount--;
    var isDone = true;
    for (var i in this.requests) {
        if (!this.requests[i]) {
            isDone = false;
            break;
        }
    }
    
    if (isDone && this.requestsCount == 0) {
        serviceListener.logHealthCheckStateToDb(this.healthCheck.id, this.healthCheck.service_id);
    }
}

function delaySendNotification(healthCheckState, delay) {
    var timeoutId = setTimeout(function() {
        var checkId = healthCheckState.healthCheck.id;
        var curHealthCheckState = healthCheckState.healthCheck.serviceMonitor.getCurrentCheckStateByCheckId(checkId);
        if (!curHealthCheckState) {
            return;
        }
        var options = curHealthCheckState.getNotificationDetails(healthCheckState.state);
        var contacts = curHealthCheckState.healthCheck.getContacts();
        if (curHealthCheckState && curHealthCheckState.state == healthCheckState.state) {
            if (healthCheckState.state == StateEnum.HEALTHY) {
                contacts = filterEmails(contacts);
            }
            sendNotifications(options, contacts, healthCheckState);
        }
    }, delay);
    var healthCheck = healthCheckState.healthCheck;
    if (healthCheck.notificationTimer) {
        clearTimeout(healthCheck.notificationTimer);
    }
    healthCheck.notificationTimer = timeoutId;
}

function filterEmails(contacts) {
    var emails = [];
    for(var i = 0; i < contacts.length; ++i) {
        var contact = contacts[i];
        if (parseInt(contact) > 1000) {

        } else if (contact) {
            emails.push(contact);
        }
    }
    return emails;
}

function allDependentChecksHealthy(healthCheck){
    if(!healthCheck.dependent_checks){
        return true;
    }
    
    var healthChecks = serviceListener.getAllHealthChecks(healthCheck.service_id);
    if(!healthChecks){
        return true;
    }
    healthChecks = healthChecks[healthCheck.service_id];
    if(!healthChecks){
        return true;
    }
    var dependentCheckIds = healthCheck.dependent_checks;
    if (typeof dependentCheckIds === "string"){
        var id = dependentCheckIds;
        dependentCheckIds = [];
        dependentCheckIds.push(id);
    }
    
    for(var x in dependentCheckIds){
        var dependentHealthCheck = healthChecks[dependentCheckIds[x]];
        if(!dependentHealthCheck){
            continue;
        }
        var dependentHealthCheckState = dependentHealthCheck.serviceMonitor.getCurrentCheckStateByCheckId(dependentHealthCheck.id);
        if(!dependentHealthCheckState){
            continue;
        }
        if(dependentHealthCheckState.state == 2){
            console.log("DEPENDENT FAILING");
            return false;
        }
    }
      
    return true;
}

function sendNotifications(options, contacts, healthCheckState) {
    for(var i = 0; i < contacts.length; ++i) {
        var contact = contacts[i];
        if (parseInt(contact) > 100000) {
            options.from = ''; //twilio phone number
            options.to = parseInt(contact);
            options.body = healthCheckState.getSmsDetails();
            if(allDependentChecksHealthy(healthCheckState.healthCheck)){
                Sms.send(options);
            }
        } else {
            options.from = 'email@email.com';
            options.to = contact;
            options.body = '';
            options.html = healthCheckState.getEmailDetails();
            if(allDependentChecksHealthy(healthCheckState.healthCheck)){
                Email.sendEmail(options);
            }
        }
    }
}

exports.HealthCheckState = HealthCheckState;
