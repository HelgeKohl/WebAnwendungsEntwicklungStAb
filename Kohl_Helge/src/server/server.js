var http = require('http');
var fs = require('fs');
var path = require('path');
var axios = require('axios');
var solr = require('./static/js/solr-helper.js');

// builds the search query for solr
function buildQuery(data){
    var url = solr.client.url() + "/select?hl=on&hl.fl=*&q="
    var query = "";

    data['keywords'].forEach(element => {
        if(element.input != ""){
            // only append concat type if its not the first attribute
            if(query != ""){
                query += " " + element.concatType + " ";
            }
            if(element.negate){
                query += "-";
            }
            // concat searchfield to query
            query += element.type + "_" + data['language'] + ":\"" + replaceAll(element.input, "\"", "\\\"") + "\"";
        }
    });

    data['channel'].forEach(element =>{ 
        if(element.input != ""){
            // only append concat type if its not the first attribute
            if(query != ""){
                query += " " + element.concatType + " ";
            }
            if(element.negate){
                query += "-";
            }
            // concat searchfield to query
            query += "channel:" + "\"" + replaceAll(element.input, "\"", "\\\"") + "\"";
        }
    });

    // empty query needs to search only right language
    if(query === "") query = "title_" + data['language'] + ":* AND subtitle_" + data['language'] + ":*";

    var startrange = " AND start:[" + data['start'].from + " TO " + data['start'].till + "]";
    var stoprange = " AND stop:[" + data['stop'].from + " TO " + data['stop'].till + "]";
    
    query = url + encodeURI(query + startrange + stoprange);
    
    query += "&rows="+ data['rows'] + "&start=" + (data['currentPage'] * data['rows'] - data['rows'])

    console.log(query)
    return query;
}

// builds the suggestion query for solr
function buildSuggestionQuery(data){
    var url = solr.client.url() + "/suggest?suggest=true&suggest.build=false";
    suggestDict = "&suggest.dictionary=" + data['type'] + "_suggester_" + data['language'];
    suggestInput = "&suggest.q=" + encodeURI(data['input']) + "&wt=json";

    url += suggestDict + suggestInput;
    return url;
}

// replaces all occurrences of a specific character in a string
function replaceAll(str, find, replace) {
    if(str != undefined){
        return str.replace(new RegExp(find, 'g'), replace);
    }
    else return str;
}

// checks if an object is already in array
function containsObject(obj, list) {
    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i].id == obj.id) {
            return true;
        }
    }

    return false;
}

function isFavourite(obj){
    var currentData;
    // check if aufnahme.json exists
    if(!fs.existsSync('aufnahme.json')){
        fs.appendFile('aufnahme.json', '[]', function (err) {
            if (err) throw err;
        });
    }

    // get currentData
    var rawdata = fs.readFileSync('aufnahme.json');
            
    // if file is empty
    if(rawdata.length == 0){
        currentData = [];
    }
    else{
        currentData = JSON.parse(rawdata);
    }

    if(containsObject(obj, currentData)) return true;
    else return false;
}

// adds <em>-tag
function highlight(old, to){
    exp = new RegExp(/<em>(.*?)<\/em>/ugm);
    let exprResult;
    
    while((exprResult = exp.exec(to)) !== null){
        old = replaceAll(old, "(?<![0-9]|<em>)" + exprResult[1]+ "(?![0-9]|<\/em>|[^<>]*>)", exprResult[0]);
    }

    return old;
}

// adds imdb link
function addLinks(description){
    exp = new RegExp(/(?<=^(?:(?:.*Regie|Drehbuch|Autor|Komponist|Kamera|Schnitt|Buch\/Autor|Musik|): ))(?:(?:[A-Za-zÀ-ÖØ-öø-ÿ. ]+))/gm);

    description = description.replace(exp, (match) => {                
        return "<a href=\"https://www.imdb.com/find?q=" + encodeURI(match) + "\" target=\"_blank\">" + match + "</a>";
    })

    artistExp = new RegExp(/(?:(?:^[A-Za-zÀ-ÖØ-öø-ÿ ]*)(?= \()|(?<=[A-Za-zÀ-ÖØ-öø-ÿ ]+ - )([A-Za-zÀ-ÖØ-öø-ÿ ]*))/gm);
    description = description.replace(artistExp, (match) => {
        return "<a href=\"https://www.imdb.com/find?q=" + match + "\" target=\"_blank\">" + match + "</a>";
    })

    return description;
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

    // search epg data
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
                    element['logofile'] = logofilesJSON[element.channel][0];
                    element['channeltype'] = logofilesJSON[element.channel][1];

                    element['desc_' + post['language']] = addLinks(element['desc_' + post['language']])

                    for (var key of elementKeys){
                        element[key] = highlight(element[key], response.data.highlighting[element['id']][key][0])
                    }
                    
                    element['isFavourite'] = isFavourite(element);

                    element['desc_' + post['language']] = replaceAll(element['desc_' + post['language']], "\n", "</br>");
                    element['subtitle_' + post['language']] = replaceAll(element['subtitle_' + post['language']], "\n", "</br>");
                });

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(response.data));
            }).catch((err) => {
                console.log(err);
                fs.readFile('./404.html', function(error, content) {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end(content, 'utf-8');
                });
            });
        });
    }
    else if(filePath == './favourites'){
        req.on('end', function() {
            var rawdata = fs.readFileSync('aufnahme.json');
            if(rawdata.length != 0){
                var currentData = JSON.parse(rawdata);
            }
            else var currentData = []

            var post = JSON.parse(body);
            var responseObject = []
            var index = (post['currentPage'] * post['rows'] - post['rows']);

            for(; index < post['rows'] * post['currentPage'] && index < currentData.length; index++){
                responseObject.push(currentData[index]);
            }

            responseObject.forEach(element => {
                element['isFavourite'] = isFavourite(element);
            });

            var response = {
                response: responseObject,
                numFound: currentData.length,
                perPage: post['rows']
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(response));
        })
    }
    else if(filePath == './addFavourite'){
        req.on('end', function() {
            var post = JSON.parse(body);
            var currentData;
            // check if aufnahme.json exists
            if(!fs.existsSync('aufnahme.json')){
                fs.appendFile('aufnahme.json', '[]', function (err) {
                    if (err) throw err;
                });
            }

            // get currentData
            var rawdata = fs.readFileSync('aufnahme.json');
            
            // if file is empty
            if(rawdata.length == 0){
                currentData = [];
            }
            else{
                currentData = JSON.parse(rawdata);
            }

            // // dont store broadcasts twice
            if(!containsObject(post, currentData)){      
                currentData.push(post);

                // remove highlighting
                currentData = JSON.stringify(currentData);
                currentData = replaceAll(currentData, "<em>", "");
                currentData = replaceAll(currentData, "</em>", "");

                fs.writeFile('aufnahme.json', currentData, function (err) {
                    if (err) return console.log(err);
                });
            }

            res.setHeader('Content-Type', 'application/json');
            res.end("added");
        })
    }
    else if(filePath == './removeFavourite'){
        req.on('end', function() {
            var post = JSON.parse(body);
            var rawdata = fs.readFileSync('aufnahme.json');
            var currentData = JSON.parse(rawdata);
            var indexToDelete;

            currentData.find(function(element, index){             
                if(element.id === post.id){
                    indexToDelete = index;
                }
            });
            currentData.splice(indexToDelete, 1);
            
            fs.writeFile('aufnahme.json', JSON.stringify(currentData), function (err) {
                if (err) return console.log(err);
            });

            res.setHeader('Content-Type', 'application/json');
            res.end("removed");
        })
    }
    // search autocomplete suggestions
    else if(filePath == './suggest'){
        req.on('end', function () {
            var post = JSON.parse(body);
            strQuery = buildSuggestionQuery(post);

            axios.get(strQuery)
            .then((response) => {
                var suggestions = [];
                var suggester = post['type'] + "_suggester_" + post['language'];
                var input = [post['input']];

                var suggestionResponse = response.data.suggest[suggester][input].suggestions;
                suggestionResponse.forEach(element => {
                    suggestions.push(element['term']);
                });

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(suggestions));
            })
            .catch((err) => {
                console.log("Error:", err)
                fs.readFile('./404.html', function(error, content) {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end(content, 'utf-8');
                });
            });
        });
    }
    // handles file delivery
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