var url = require("url");
var template = require("../model/template");
var logger = require("../helpers/logger").getInstance();
var sorters = require("../helpers/sorters");

function handleRequest(req, res) {
    var queryString = req.body;
    var templates = template.getAllTemplates();
    var sortedTemplates = template.getAllTemplatesSorted();
    var templateTypes = template.TemplateTypes;
    var stringTemplateTypes = [];
    for(var x in templateTypes){
        if(x !== "Template"){
            stringTemplateTypes.push(x);
        }
    }
    
    res.render("template.jade", {
        templates:sortedTemplates,
        unsortedStringTemplates:JSON.stringify(templates),
        sortedStringTemplates:JSON.stringify(sortedTemplates),
        templateTypes:JSON.stringify(stringTemplateTypes),
        action:queryString.action,
        parameters:template.getParameters(),
    });
}

exports.handleRequest = handleRequest;