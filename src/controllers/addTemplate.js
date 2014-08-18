var url = require("url");
var Templates = require("../model/template");
var logger = require("../helpers/logger").getInstance();
function handleRequest(req, res) {
    var queryString = req.body;
    
    if(queryString.action == "add"){
        logger.debug('new template: ' );
        var Template = Templates.Template;
        if(queryString.type !== ""){
            Template = Templates[queryString.type];
        }
        if(!Template){
            logger.error("Invalid template type " + queryString.type);
            res.redirect('/viewTemplates');
            return;
        }
        
        var template = new Template();
        template.init(queryString.id, queryString.type, queryString.name, queryString.subject, queryString.body, new Date(), new Date());
        template.addTemplateToDb(function(){
            var templates = Templates.getAllTemplates();
            var sortedTemplates = Templates.getAllTemplatesSorted();
            res.send({templates:templates,
                      sortedTemplates:sortedTemplates,
                      template_id:template.id});
            res.end();
        });
    }
    else if(queryString.action == "edit"){
        var template = Templates.getTemplate(queryString.id);
        template.init(template.id, template.type, queryString.name, queryString.subject, queryString.body, template.timeCreated, new Date());
        template.editTemplate(function(){
            var templates = Templates.getAllTemplates();
            var sortedTemplates = Templates.getAllTemplatesSorted();
            res.send({templates:templates,
                      sortedTemplates:sortedTemplates,
                      template_id:template.id});
            res.end();
        });
    }
}

exports.handleRequest = handleRequest;