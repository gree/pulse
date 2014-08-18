
function handleRequest(req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write("SUCCESS");
    res.end();
}

exports.handleRequest = handleRequest;
