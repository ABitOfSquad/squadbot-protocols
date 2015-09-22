var fs = require('fs');
var path = require('path');
var io;

protocol.homeGroup = "debug";

/**
 * Socket and http handling
 */
protocol.init = function(settings){
    var http = require('http').createServer(function (req, res) {
        var index = fs.readFileSync(path.resolve(__dirname, "index.html"));

        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(index);
    }).listen(settings["port"]);

    io = require('socket.io')(http, { log: false });

    io.on('connection', function(socket){

        socket.on('chatMsg', function(msg, sender){
            io.emit('chatMsg', msg, sender);
            protocol.emit("message", "debug", msg, {"sender" : sender})
        });

    });

    setInterval(function(){
        var ram = getMemoryString();
        var uptime = getUptimeString();
        io.emit("debug", ram, uptime);
    }, 500);

    protocol.emit("finished")
};


/**
 * API
 */

exports.sendMessage = function(msg){
    io.emit('chatMsg', msg, "SquadBot");
}

/**
 * MISC
 */

function getMemoryString(){
    var mem = process.memoryUsage().rss;
    return formatSizeUnits(mem);
}

function getUptimeString(){
    var uptime = Math.floor(process.uptime());
    var hours = parseInt( uptime / 3600 ) % 24;
    var minutes = parseInt( uptime / 60 ) % 60;
    var seconds = uptime % 60;

    return (hours < 10 ? "0" + hours : hours) + " Hours, " + (minutes < 10 ? "0" + minutes : minutes) + " Minutes, " + (seconds  < 10 ? "0" + seconds : seconds) + " Seconds"
}

function formatSizeUnits(bytes){
    if      (bytes>=1000000000) {bytes=(bytes/1000000000).toFixed(2)+ ' GB';}
    else if (bytes>=1000000)    {bytes=(bytes/1000000).toFixed(2)+' MB';}
    else if (bytes>=1000)       {bytes=(bytes/1000).toFixed(2)+' KB';}
    else if (bytes>1)           {bytes=bytes+' bytes';}
    else if (bytes==1)          {bytes=bytes+' byte';}
    else                        {bytes='0 byte';}
    return bytes;
}

