var whapi = require("whatsapi")
var events = require("events");
var http = require("http");
var stream = require("stream").Transform
var fs = require("fs");

var protSettings
var typingTimeout
var wa

exports.init = function(loadedSettings) {
    protSettings = loadedSettings
    
    wa = whapi.createAdapter({
        msisdn: protSettings["telnumber"], // phone number with country code
        username: protSettings["displayname"], // your name on WhatsApp
        password: protSettings["whatsapp_pass"], // WhatsApp password
        ccode: "44" // country code
    });
    
    protocol.homeGroup = protSettings["homeGroup"]

    wa.setMaxListeners(250)

    wa.connect(function connected(err) {
        if (err) {
            return console.log(err)
        }
        
        print("Connected");
        wa.login(logged);
    });
}

function logged(err) {
    if (err) { console.log(err); return; }
    print('Logged in to WA server');
    wa.sendIsOnline();
    print("Getting groups");

    wa.requestGroupsList(function(err, groups) {
        var homegroup
        
        groups.forEach(function(g) {
            print('Name: ' + g.subject + ', Participants: ' + g.participants.length);
            if(g.groupId + "@g.us" == protSettings["homeGroup"]){
                homegroup = g;
                print("Found squadbot's home group");
                
                // Call when protocol ready
                bot.emit("loadingProtocolDone")
            }
        });

        if(!homegroup) {
            print("Could not find group", "red")
            process.exit();
        }

        wa.on("receivedMessage", function(message) {
            console.log("sns");
            // if (message.from.split("@")[0] == protSettings["homeGroup"]) {
            //     
            //     if (message.body.substring(0, 1) == "!" || message.body.substring(0, 1) == "/") {
            //         var parts = message.body.substring(1).split(" ");
            //         
            //         bot.emit("command", parts[0].toLowerCase(), parts.slice(1), message)
            //     } else {
            //         bot.emit("message", message.body, message);
            //     }
            // }
            // else if (!message.isGroup) {
            //     if (message.body.substring(0, 1) == "!" || message.body.substring(0, 1) == "/") {
            //         var parts = message.body.substring(1).split(" ");
            //         
            //         bot.private(message.from).emit("command", message.from, parts[0].toLowerCase(), parts.slice(1), message)
            //     } else {
            //         bot.private(message.from).emit("message", message.from, message.body, message);
            //     }
            // }
            // 
            console.log("sn");
            protocol.emit("message", message.from, message.body, message)
            
            wa.sendMessageReceipt(message);
        })

        wa.on("receivedLocation", function(loc) {
            protocol.emit("location", loc.from, loc)
        })
        
        function getMedia(url, callback) {
            request(url, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var file = "./tmp/tmp-" + Math.round(Math.random() * 10000000)
                            
                    fs.writeFileSync(file, body)
                    console.log(file);
                }
            })
            // http.request(url, function(response) {
            //     var data = new stream()
            //     
            //     response.on("data", function(chunk) {
            //         data.push(chunk)
            //     })
            //     
            //     response.on("error", function(err) {
            //         throw "Error while downloading incoming media"
            //     });
            //     
            //     response.on("end", function() {
            //         var file = "./tmp/tmp-" + Math.round(Math.random() * 10000000) + "." + suffix
            //         
            //         fs.writeFileSync(file, data.read())
            //         callback(file)
            //     });
            // }).end()
        }
        
        wa.on("receivedImage", function(image) {
            console.log(image);
            if (image.from.split("@")[0] == protSettings["homeGroup"] || image.from.split("@")[1] != "g.us") {
                getMedia(image.url, function(file) {
                    console.log(file);
                })
            }
        })

        wa.on("presence", function(pres) {
            var event = pres.type == "available" ? "online" : "offline"
            
            protocol.emit(event, pres.from)
        })

        wa.on("typing", function(type, from, author) {
            var event = type == "composing" ? "typing" : "stopedTyping"
            
            protocol.emit(event, from, author)
        })
    });

}

function handleReceivedEvents(id, emitter, err) {
    function recv(args) {
        if (args.id == id) {
            emitter.emit(args.type, args.from, args.time)
        }
    }
    
    if (err) {
        console.log(err.message);
        return; 
    }
    
    emitter.emit("send")
    
    wa.on("clientReceived", recv)
    
    setTimeout(function () {
        wa.removeListener("clientReceived", recv);
    }, 900000); // Remove after 15 min to free memory
}

protocol.sendMessage = function(msg, to) {
    emitter = new events.EventEmitter();
    
    var to = to ? to : protSettings["homeGroup"]
    
    try {
        wa.sendMessage(to, encodeEmoji(msg), function(err, id) {handleReceivedEvents(id, emitter, err)});
    } catch (err) {
        emitter.emit("error", err)
        console.log(err.stack);
    }
    
    return emitter
}

protocol.sendImage = function(image, caption) {return sendMedia(image, ["image/jpeg", "image/png"], "png", "sendImage", caption)}
protocol.sendVideo = function(video, caption) {return sendMedia(video, ["video/mp4"], "mp4", "sendVideo", caption)}
protocol.sendAudio = function(audio) {return sendMedia(audio, ["audio/mpeg", "audio/x-wav"], "mp3", "sendAudio")}

function sendMedia(location, mimes, suffix, type, caption, to) {
    emitter = new events.EventEmitter();
    
    if (type == "sendAudio") {
        var to = caption ? caption : protSettings["homeGroup"]
    }
    else {
        var to = to ? to : protSettings["homeGroup"]
    }
    
    try {
        if (location.substring(0, 7) == "http://") {
            http.request(location, function(response) {
                if (mimes) {
                    if (response.headers["content-type"]) {
                        if (mimes.indexOf(response.headers["content-type"]) == -1) {
                            emitter.emit("err", "Server sends an unsupported file type")
                        }
                    }
                }
                var data = new stream()
                
                response.on("data", function(chunk) {
                    data.push(chunk)
                })
                
                response.on("error", function(err) {
                    emitter.emit("error", err.message)
                });
                
                response.on("end", function() {
                    var file = "./tmp/tmp-" + Math.round(Math.random() * 10000000) + "." + suffix
                    
                    fs.writeFileSync(file, data.read())
                    
                    if (type == "sendAudio") {
                        wa[type](to, file, function(err, id) {handleReceivedEvents(id, emitter, err)})
                    }
                    else {
                        wa[type](to, file, encodeEmoji(caption), function(err, id) {handleReceivedEvents(id, emitter, err)})
                    }
                });
            }).end()
        }
        else {
            if (type == "sendAudio") {
                wa[type](to, location, function(err, id) {handleReceivedEvents(id, emitter, err)})
            }
            else {
                wa[type](to, location, encodeEmoji(caption), function(err, id) {handleReceivedEvents(id, emitter, err)})
            }
        }
        
        
    } catch (err) {
        console.log(err.stack);
        emitter.emit("err", err.message)
    } 
    
    return emitter
}


protocol.sendContact = function(fields, to) {
    emitter = new events.EventEmitter();
    var to = to ? to : protSettings["homeGroup"]
    
    try {
        var vcard = "BEGIN:VCARD"
        vcard += "\nVERSION:3.0"
        
        if (!fields.name) {
            throw "Missing contact name"
        }
        
        for (var key in fields) {
           if (fields.hasOwnProperty(key)) {
               switch (key) {
                   case "name":
                        vcard += "\nN:" + encodeEmoji(fields[key])
                        vcard += "\nFN:" + encodeEmoji(fields[key])
                        break;
                   case "phone":
                        vcard += "\nTEL;TYPE=voice,home,pref:" + fields[key]
                        break;
                   case "email":
                        vcard += "\nEMAIL:" + fields[key]
                        break;
                   default:
                        throw new Error("Unknown field " + key)
               }
           }
       }
       
       vcard += "\nEND:VCARD"
       
       fs.writeFileSync("./tmp/vcard.vcf", vcard)
       wa.sendVcard(to, "./tmp/vcard.vcf", fields.name, function(err, id) {handleReceivedEvents(id, emitter, err, "./tmp/vcard.vcf")})
    } catch (err) {
        emitter.emit("err", err)
    } 
    
    return emitter
};

protocol.sendTyping = function(duration, to) {
    var to = to ? to : protSettings["homeGroup"]
    wa.sendComposingState(to)
        
    typingTimeout = setTimeout(function() {
        wa.sendPausedState(sto)
    }, duration)
}

protocol.getMembers = function (callback) {
    wa.requestGroupInfo(protSettings["homeGroup"], function(err, group) {
        if (!err) {
            try {
                callback(group.participants)
            } catch (err) {
                console.log(err.stack);
            }
        }
    });
};

bot.admin = {}
bot.admin = {
    "check": function checkIfAdmin(callback) {
        wa.requestGroupInfo(protSettings["homeGroup"], function(err, data) {
            if (err) {
                try {
                    callback(err, null)
                } catch (err) {
                    console.log(err.stack);
                }
                return
            }
            
            for (var i = 0; i < data.participants.length; i++) {
                if (data.participants[i].jid.split("@")[0] == protSettings["telnumber"]) {
                    try {
                        callback(false, data.participants[i].admin)
                    } catch (err) {
                        console.log(err.stack);
                    }
                    
                    console.log(data.participants[i]);
                }
            }
        })
    }
}
