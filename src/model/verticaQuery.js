var logger = require("../helpers/logger").getInstance();
var Vertica = require('vertica');
var passwords = require("../config/passwords");
var helpers = require("../helpers/helpers");

// Vertica Query Code
function runVerticaQuery(dbString,inputQuery,callback) {
    var query = inputQuery;
    query = helpers.addEpochToVerticaQuery(query);
    var connection = dbString;
    var checkServer = function(connectionString) {
        var connectionStringSplit = connectionString.split(":");
        if (connectionStringSplit.length >= 4) {
            var host = connectionStringSplit[0];
            var port = connectionStringSplit[1];
            var database = connectionStringSplit[2];
            var user = connectionStringSplit[3];
            var password = passwords.config[user];
            var databaseName = host + ':' + database;
            var pool = require('../helpers/verticaConnectionPool').getInstance(user, password, database, host, port);
            // acquire connection - callback function is called
            // once a resource becomes available
            pool.acquire(function(err, client) {
               if(err){
                   callback("VERTICA CONNECTION ERROR " + err);
                   return;
               }
               client.on('error', function(err){
                   pool.destroy(client);
                   callback("VERTICA CONNECTION ERROR " + err);
                   return;
               });

               //need to handle the underlying connection error
               client.connection.on('error', function (err) {
                   pool.destroy(client);
                   callback(err);
                   return;
               });
               if(query == ''){
                   pool.release(client);
                   callback("query is empty");
                   return;
               }
               var conn;
               try{           
                   conn = client.query(query, function(err, results) {
                       pool.release(client);
                       if(err){
                           callback(err);
                           return;
                       } else {
                       // @TODO: MAKE SURE NO UPDATE,INSERT,DROP, etc are called.
                           if(results && "fields" in results && "rows" in results){
                               if(results.rows.length == 1){
                                   if(results.fields.length == 1){
                                       for (var field in results.fields) {
                                           result = results.rows[0][field];
                                           if(result == null){
                                               result = "empty_result";
                                           }
                                           break;
                                       }
                                       callback(null,result);
                                   } else {
                                       callback("too many (or too few) fields returned for query: "+results.length);
                                       return;
                                   }
                               } else {
                                   callback("too many (or too few) rows returned for query: "+results.length);
                                   return;
                               }
                           } else {
                               callback("results does not contain 'fields' and/or 'rows'");
                               return;
                           }
                       }
                   });
               }catch(err){
                   var error = {};
                   error["message"] = err; // becasue the checkResponse expects a message in the error
                   callback(error);
                   pool.destroy(client); // destroy directly because the pooler won't unless there are no requests for a period
                   return;
               }
               conn.on('error', function(error){
                   callback('vertica query error: '+error);
                   return;
               });
           });
        } else {
            callback("Not enough connection parameters for vertica connection: " + connectionString);
            return;
        }
    };
    return checkServer(connection);
}

exports.runVerticaQuery = runVerticaQuery;