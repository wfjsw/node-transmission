//node utils
var http = require('http');
var https = require('https');
var util = require('util');
var fs = require('fs');
var events = require('events');
var async = require('async');

var uuid = require('./utils').uuid;

var Transmission = module.exports = function (options) {

    events.EventEmitter.call(this);

    options = options || {};
    this.url = options.url || '/transmission/rpc';
    this.host = options.host || 'localhost';
    this.port = options.port || 9091;
    this.ssl = options.ssl == true ? true : false;
    this.key = null;

    if (options.username) {
        this.authHeader = 'Basic ' + new Buffer(options.username + (options.password ? ':' + options.password : '')).toString('base64');
    }

};
// So will act like an event emitter
util.inherits(Transmission, events.EventEmitter);

Transmission.prototype.set = function (ids, options = {}) {
    return new Promise(function (rs, rj) {
        ids = Array.isArray(ids) ? ids : [ids]
        var args = { ids: ids }
        args = Object.assign({}, args, options)
        this.callServer({
            arguments: args,
            method: this.methods.torrents.set,
            tag: uuid()
        })
        .then(rs, rj)
    })

};

Transmission.prototype.add = function (path, options) {
    // for retro-compatibility with old function
    return this.addUrl(path, options);
};

Transmission.prototype.addFile = function (filePath, options = {}) {
    var self = this;
    new Promise(function(rs, rj) { 
        fs.readFile(filePath, function (err, data) {
            if (err) 
                rj(err)
            var fileContentBase64 = new Buffer(data).toString('base64');
            var args = {};
            args.metainfo = fileContentBase64;
            self.addTorrentDataSrc(args, options)
            .then(rs, rj)
        });
    })
};

Transmission.prototype.addBase64 = function (fileb64, options = {}) {
    var args = {};
    args.metainfo = fileb64;
    return this.addTorrentDataSrc(args, options);
};

Transmission.prototype.addUrl = function (url, options = {}) {
    var args = {};
    args.filename = url;
    return this.addTorrentDataSrc(args, options);
};

Transmission.prototype.addTorrentDataSrc = function (args, options = {}) {
    args = Object.assign({}, args, options)
    this.callServer({
        arguments: args,
        method: this.methods.torrents.add,
        tag: uuid()
    }).then( function (result) {
        var torrent = result['torrent-duplicate'] ? result['torrent-duplicate'] : result['torrent-added']
        return torrent
    })
};

Transmission.prototype.remove = function (ids, del) {
    ids = Array.isArray(ids) ? ids : [ids];
    del = del || false
    return this.callServer({
        arguments: {
            ids: ids,
            'delete-local-data': !!del
        },
        method: this.methods.torrents.remove,
        tag: uuid()
    });
};

Transmission.prototype.move = function (ids, location, move = true) {
    ids = Array.isArray(ids) ? ids : [ids];
    var options = {
        arguments: {
            ids: ids,
            location: location,
            move: move
        },
        method: this.methods.torrents.location,
        tag: uuid()
    };
    return this.callServer(options);
};


Transmission.prototype.rename = function (ids, path, name) {
    ids = Array.isArray(ids) ? ids : [ids];
    var options = {
        arguments: {
            ids: ids,
            path: path,
            name: name
        },
        method: this.methods.torrents.rename,
        tag: uuid()
    };
    return this.callServer(options);
};


Transmission.prototype.get = function (ids) {
    var options = {
        arguments: {
            fields: this.methods.torrents.fields,
        },
        method: this.methods.torrents.get,
        tag: uuid()
    };

    if (ids) 
        options.arguments.ids = Array.isArray(ids) ? ids : [ids];

    return this.callServer(options);
    //return this;
};

Transmission.prototype.waitForState = function (id, targetState) {

    var self = this;
    var latestState = 'unknown';
    var latestTorrent = null;
    return new Promise(function(rs, rj) {
        async.whilst(function (a) {
            return latestState !== targetState;
        }, function (whilstCb) {
            self.get(id, function (err, result) {
                if (err) {
                    return whilstCb(err);
                }
                var torrent = result.torrents[0];

                if (!torrent) {
                    rj(new Error('No id (' + id + ') found for torrent'))
                }

                latestTorrent = torrent;
                latestState = self.statusArray[torrent.status];
                if (latestState === targetState) {
                    whilstCb(null, torrent);
                } else {
                    setTimeout(whilstCb, 1000);
                }
            });
        }, function (err) {
            if (err) rj(err)
            else rs(latestTorrent);
        })
    })
};

Transmission.prototype.peers = function (ids, callback) {
    ids = Array.isArray(ids) ? ids : [ids];
    var options = {
        arguments: {
            fields: ['peers', 'hashString', 'id'],
            ids: ids
        },
        method: this.methods.torrents.get,
        tag: uuid()
    };

    return this.callServer(options)
    .then(function (result) {
        return result.torrents
    });
    //return this;
};

Transmission.prototype.files = function (ids) {
    ids = Array.isArray(ids) ? ids : [ids];
    var options = {
        arguments: {
            fields: ['files', 'fileStats', 'hashString', 'id'],
            ids: ids
        },
        method: this.methods.torrents.get,
        tag: uuid()
    };

    return this.callServer(options)
    .then(function (result) {
        return result.torrents
    });
    //return this;
};

Transmission.prototype.fast = function (ids) {
    ids = Array.isArray(ids) ? ids : [ids];
    var options = {
        arguments: {
            fields: ['id', 'error', 'errorString', 'eta', 'isFinished', 'isStalled', 'leftUntilDone', 'metadataPercentComplete', 'peersConnected', 'peersGettingFromUs', 'peersSendingToUs', 'percentDone', 'queuePosition', 'rateDownload', 'rateUpload', 'recheckProgress', 'seedRatioMode', 'seedRatioLimit', 'sizeWhenDone', 'status', 'trackers', 'uploadedEver', 'uploadRatio'],
            ids: ids
        },
        method: this.methods.torrents.get,
        tag: uuid()
    };
    return this.callServer(options)
    .then(function (result) {
        return result.torrents
    });
    //return this;
};

Transmission.prototype.stop = function (ids) {
    ids = Array.isArray(ids) ? ids : [ids]
    return this.callServer({
        arguments: {
            ids: ids
        },
        method: this.methods.torrents.stop,
        tag: uuid()
    })
    //return this;
}

Transmission.prototype.stopAll = function () {
    return this.callServer({
        method: this.methods.torrents.stop
    })
    //return this;
}

Transmission.prototype.start = function (ids) {
    ids = Array.isArray(ids) ? ids : [ids]
    return this.callServer({
        arguments: {
            ids: ids
        },
        method: this.methods.torrents.start,
        tag: uuid()
    })
    //return this;
}

Transmission.prototype.startAll = function () {
    return this.callServer({
        method: this.methods.torrents.start
    })
    //return this
}

Transmission.prototype.startNow = function (ids) {
    ids = Array.isArray(ids) ? ids : [ids]
    return this.callServer({
        arguments: {
            ids: ids
        },
        method: this.methods.torrents.startNow,
        tag: uuid()
    })
    //return this;
}

Transmission.prototype.verify = function (ids) {
    ids = Array.isArray(ids) ? ids : [ids];
    return this.callServer({
        arguments: {
            ids: ids
        },
        method: this.methods.torrents.verify,
        tag: uuid()
    });
    //return this;
}

Transmission.prototype.reannounce = function (ids) {
    ids = Array.isArray(ids) ? ids : [ids];
    return this.callServer({
        arguments: {
            ids: ids
        },
        method: this.methods.torrents.reannounce,
        tag: uuid()
    })
    //return this;
}

Transmission.prototype.all = function () {
    return this.callServer({
        arguments: {
            fields: this.methods.torrents.fields
        },
        method: this.methods.torrents.get,
        tag: uuid()
    })
    //return this;
}

Transmission.prototype.active = function () {
    var options = {
        arguments: {
            fields: this.methods.torrents.fields,
            ids: 'recently-active'
        },
        method: this.methods.torrents.get,
        tag: uuid()
    };
    return this.callServer(options)
    //return this;
}

Transmission.prototype.session = function (data) {
    var options = {};
    return new Promise(function(rs, rj) {
        if (data) {
            var keys = Object.keys(data);
            var key;
            for (var i = 0, j = keys.length; i < j; i++) {
                key = keys[i];
                if (!this.methods.session.setTypes[key]) {
                    var error = new Error('Cant set type ' + key);
                    // error.result = page; // FIXME: page not defined
                    rj(error);
                }
            }
            options = {
                arguments: data,
                method: this.methods.session.set,
                tag: uuid()
            };
            this.callServer(options).then(rs, rj)
        } else {
            options = {
                method: this.methods.session.get,
                tag: uuid()
            };
            this.callServer(options).then(rs, rj)
        }
    })
}

Transmission.prototype.sessionStats = function () {
    var options = {
        method: this.methods.session.stats,
        tag: uuid()
    };
    return this.callServer(options)
}

Transmission.prototype.freeSpace = function (path) {
    return this.callServer({
        arguments: {
            path: path
        },
        method: this.methods.other.freeSpace
    })
    //return this;
}

Transmission.prototype.callServer = function (query) {
    var self = this;
    return new Promise(function (rs, rj) {
        var queryJsonify = JSON.stringify(query);
        var options = {
            host: this.host,
            path: this.url,
            port: this.port,
            method: 'POST',
            headers: {
                'Host': this.host + ':' + this.port,
                'X-Requested-With': 'Node',
                'X-Transmission-Session-Id': this.key || '',
                'Content-Length': queryJsonify.length,
                'Content-Type': 'application/json'
            }
        };

        if (this.authHeader) {
            options.headers.Authorization = this.authHeader;
        }

        function onResponse(response) {
            var page = [];

            function onData(chunk) {
                page.push(chunk);
            }

            function onEnd() {
                var json, error;
                if (response.statusCode === 409) {
                    self.key = response.headers['x-transmission-session-id'];
                    return self.callServer(query);
                } else if (response.statusCode === 200) {
                    page = page.join('');
                    try {
                        json = JSON.parse(page);
                    } catch (err) {
                        return rj(err);
                    }

                    if (json.result === 'success') {
                        rs(json.arguments);
                    } else {
                        error = new Error(json.result);
                        error.result = page;
                        rj(error);
                    }
                } else {
                    error = new Error('Status code mismatch: ' + response.statusCode);
                    error.result = page;
                    rj(error);
                }
            }


            response.setEncoding('utf8');
            response.on('data', onData);
            response.on('end', onEnd);
        }

        var res = (this.ssl ? https : http).request(options, onResponse);
        res.on('error', rj).end(queryJsonify, 'utf8');
    })
};

Transmission.prototype.statusArray = ['STOPPED', 'CHECK_WAIT', 'CHECK', 'DOWNLOAD_WAIT', 'DOWNLOAD', 'SEED_WAIT', 'SEED', 'ISOLATED'];
Transmission.prototype.status = {};

Transmission.prototype.statusArray.forEach(function (status, i) {
    Transmission.prototype.status[status] = i;
});

Transmission.prototype.methods = {
    torrents: {
        stop: 'torrent-stop',
        start: 'torrent-start',
        startNow: 'torrent-start-now',
        verify: 'torrent-verify',
        reannounce: 'torrent-reannounce',
        set: 'torrent-set',
        setTypes: {
            'bandwidthPriority': true,
            'downloadLimit': true,
            'downloadLimited': true,
            'files-wanted': true,
            'files-unwanted': true,
            'honorsSessionLimits': true,
            'ids': true,
            'location': true,
            'peer-limit': true,
            'priority-high': true,
            'priority-low': true,
            'priority-normal': true,
            'seedRatioLimit': true,
            'seedRatioMode': true,
            'uploadLimit': true,
            'uploadLimited': true
        },
        add: 'torrent-add',
        addTypes: {
            'download-dir': true,
            'filename': true,
            'metainfo': true,
            'paused': true,
            'peer-limit': true,
            'files-wanted': true,
            'files-unwanted': true,
            'priority-high': true,
            'priority-low': true,
            'priority-normal': true
        },
        rename: 'torrent-rename-path',
        remove: 'torrent-remove',
        removeTypes: {
            'ids': true,
            'delete-local-data': true
        },
        location: 'torrent-set-location',
        locationTypes: {
            'location': true,
            'ids': true,
            'move': true
        },
        get: 'torrent-get',
        fields: ['activityDate', 'addedDate', 'bandwidthPriority', 'comment', 'corruptEver', 'creator', 'dateCreated', 'desiredAvailable', 'doneDate', 'downloadDir', 'downloadedEver', 'downloadLimit', 'downloadLimited', 'error', 'errorString', 'eta', 'files', 'fileStats', 'hashString', 'haveUnchecked', 'haveValid', 'honorsSessionLimits', 'id', 'isFinished', 'isPrivate', 'leftUntilDone', 'magnetLink', 'manualAnnounceTime', 'maxConnectedPeers', 'metadataPercentComplete', 'name', 'peer-limit', 'peers', 'peersConnected', 'peersFrom', 'peersGettingFromUs', 'peersKnown', 'peersSendingToUs', 'percentDone', 'pieces', 'pieceCount', 'pieceSize', 'priorities', 'rateDownload', 'rateUpload', 'recheckProgress', 'seedIdleLimit', 'seedIdleMode', 'seedRatioLimit', 'seedRatioMode', 'sizeWhenDone', 'startDate', 'status', 'trackers', 'trackerStats', 'totalSize', 'torrentFile', 'uploadedEver', 'uploadLimit', 'uploadLimited', 'uploadRatio', 'wanted', 'webseeds', 'webseedsSendingToUs']
    },
    session: {
        stats: 'session-stats',
        get: 'session-get',
        set: 'session-set',
        setTypes: {
            'start-added-torrents': true,
            'alt-speed-down': true,
            'alt-speed-enabled': true,
            'alt-speed-time-begin': true,
            'alt-speed-time-enabled': true,
            'alt-speed-time-end': true,
            'alt-speed-time-day': true,
            'alt-speed-up': true,
            'blocklist-enabled': true,
            'dht-enabled': true,
            'encryption': true,
            'download-dir': true,
            'peer-limit-global': true,
            'peer-limit-per-torrent': true,
            'pex-enabled': true,
            'peer-port': true,
            'peer-port-random-on-start': true,
            'port-forwarding-enabled': true,
            'seedRatioLimit': true,
            'seedRatioLimited': true,
            'speed-limit-down': true,
            'speed-limit-down-enabled': true,
            'speed-limit-up': true,
            'speed-limit-up-enabled': true
        }
    },
    other: {
        blockList: 'blocklist-update',
        port: 'port-test',
        freeSpace: 'free-space'
    }
};
