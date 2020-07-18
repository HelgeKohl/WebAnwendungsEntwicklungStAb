var http = require('http');
var fs = require('fs');
var path = require('path');
var axios = require('axios');
var solr = require('./static/js/solr-helper.js');


function buildQuery(data){
    var url = solr.client.url() + "/select?hl=on&hl.fl=*&hl.fragsize=-1&q="
    var query = "";

    data['keywords'].forEach(element => {
        if(element.input != ""){
            if(query != ""){
                query += " " + element.concatType.toUpperCase() + " ";
            }
            if(element.negate){
                query += "-";
            }
            query += element.type + "_" + data['language'] + ":\"" + element.input + "\"";
        }
    });

    data['channel'].forEach(element =>{ 
        if(element.input != ""){
            if(query != ""){
                query += " " + element.concatType.toUpperCase() + " ";
            }
            if(element.negate){
                query += "-";
            }
            query += "channel%3A" + "\"" + element.input + "\"";
        }
    });

    // empty query needs to search only right language
    if(query === "") query = "title_" + data['language'] + ":* AND subtitle_" + data['language'] + ":*";
    var startrange = " AND start:[" + data['start'].from + " TO " + data['start'].till + "]";
    var stoprange = " AND stop:[" + data['stop'].from + " TO " + data['stop'].till + "]";
    

    query = url + escape(query+startrange+stoprange);
    query += "&rows=10" + "&start=" + (data['rows'] - 10)
    console.log(query);
    return query;
}

function replaceAll(str, find, replace) {
    if(str != undefined){
        return str.replace(new RegExp(find, 'g'), replace);
    }
    else return str;
}

http.createServer(function (req, res) {
    var filePath = '.' + req.url;
    if (filePath == './') {
        filePath = './static/index.html';
    }
    console.log(filePath)

    // request handling
    var body = '';

    req.on('data', function (data) {
        body += data;

        // Too much POST data, kill the connection!
        // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
        if (body.length > 1e6)
        req.connection.destroy();
    });

    if(filePath == './search'){
        req.on('end', function () {
            let rawdata = fs.readFileSync('logofiles.json');
            let logofilesJSON = JSON.parse(rawdata);
            var post = JSON.parse(body);
            
            strQuery = buildQuery(post);
            axios.get(strQuery)
            .then((response) => {
                response.data.response.docs.forEach(element => {
                    elementKeys = Object.keys(response.data.highlighting[element['id']]);
                    for (var key of elementKeys){
                        element[key] = response.data.highlighting[element['id']][key][0]
                    }
                    element['desc_' + post['language']] = replaceAll(element['desc_' + post['language']], "\n", "</br>")
                    element['subtitle_' + post['language']] = replaceAll(element['subtitle_' + post['language']], "\n", "</br>")
                    element['logofile'] = logofilesJSON[element.channel][0];
                    element['channeltype'] = logofilesJSON[element.channel][1];
                });

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(response.data));
            })
        });
        
    }
    else if(/^\.\/static\//.test(filePath)){
        var extname = String(path.extname(filePath)).toLowerCase();

        var mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
        };

        var contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, function(error, content) {
            if(error) {
                if(error.code == 'ENOENT') {
                    fs.readFile('./404.html', function(error, content) {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    });
                }
                else {
                    res.writeHead(500);
                    res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
                }
            }
            else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }
    else{
        fs.readFile('./404.html', function(error, content) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
        });
    }
}).listen(8080);

console.log('Webserver wird ausgeführt.');