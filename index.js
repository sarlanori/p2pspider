'use strict';

var P2PSpider = require('./lib');
var sqlite3 = require('sqlite3').verbose();
var infoDb = new sqlite3.Database('torrent.db');
var crawledCount = 0;

var p2p = P2PSpider({
    //nodesMaxSize: 200,   // be careful
    //maxConnections: 400, // be careful
    nodesMaxSize: 400,
    maxConnections: 800,
    timeout: 10000
});

p2p.ignore(function (infohash, rinfo, callback) {
    // false => always to download the metadata even though the metadata is exists.
    //var theInfohashIsExistsInDatabase = false;
    //callback(theInfohashIsExistsInDatabase);
    infoDb.serialize(function () {
        infoDb.all('select * from torrent_info where infohash="' + infohash + '"', function (err, rows) {
            if (err) {
                console.log(err);
                callback(false);
                return;
            }
            callback(rows.length > 0);
        });
    });
});

p2p.on('metadata', function (metadata) {
    // At here, you can extract data and save into database.
    //console.log(metadata);
    /*
    var data = {};
    data.magnet = metadata.magnet;
    data.name = metadata.info.name ? metadata.info.name.toString() : '';
    data.fetchedAt = new Date().getTime();
    data.length = 0;
    if(metadata.info.files){ // multi files
        for(var i= 0;i< metadata.info.files.length;i++){
            var file = metadata.info.files[i];
            data.length += file.length;
            console.log('file path:' + file.path);
        }
        
    }else{ // single file
        data.length = metadata.info.length;
    }

    console.log('name:' + data.name);
    console.log('magnet:' + data.magnet);
    console.log('length:' + data.length);
    console.log('---------------------------------');
    */
    save_metadata(metadata);
});

/*
* 表 torrent_files 字段 files 的结构：path + length，其中 length 是指该文件的大小（单位字节），double 型，占 8 个字节
* 剩余字节都是 path。
*/
function create_tables() {
    infoDb.serialize(function () {
        infoDb.run("create table if not exists torrent_info(infohash varchar(40) primary key,name varchar(255),magnet varchar(255),total_length integer,fetched_at integer);");
        infoDb.run("create table if not exists torrent_detail(infohash varchar(40) primary key,filename varchar(255),filesize integer,fetched_at integer);");
    });
}

function encode_files(files) {
    var length = get_files_byte_length(files);
    var buf = new Buffer(length);
    var offset = 0;
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var pathLen = Buffer.byteLength(file.path, 'utf8');
        buf.writeInt32LE(pathLen, offset);
        offset += 4;
        buf.write(file.path, offset, 'utf8');
        offset += pathLen;
        buf.writeDoubleLE(file.length, offset);
        offset += 8;
    }
    return buf;
}

function get_files_byte_length(files) {
    var totalLength = 0;
    for (var i = 0; i < files.length; i++) {
        totalLength += 4;
        totalLength += Buffer.byteLength(files[i].path, 'utf8');
        totalLength += 8;
    }
    return totalLength;
}

function save_metadata(metadata) {
    var data = {};
    data.magnet = metadata.magnet;
    //data.name = metadata.info.name ? metadata.info.name.toString() : '';
    data.name = metadata.info['name.utf-8'] ? metadata.info['name.utf-8'].toString() : metadata.info.name.toString();
    data.infohash = metadata.infohash;
    data.fetchedAt = new Date().getTime();
    data.files = [];
    data.totalLength = 0;
    if (metadata.info.files) { // multi files
        for (var i = 0; i < metadata.info.files.length; i++) {
            var file = metadata.info.files[i];
            data.files[i] = {};
            data.files[i].length = file.length;
            data.files[i].path = file.path.toString();
            data.totalLength += file.length;
        }
    } else { // single file
        data.files[0] = {};
        data.files[0].length = metadata.info.length;
        data.files[0].path = data.name;
        data.totalLength = metadata.info.length;
    }

    infoDb.serialize(function () {
        infoDb.all('select * from torrent_info where infohash="' + data.infohash + '"', function (err, rows) {
            if (err) {
                console.log('Save metadata failed: ' + err);
                return;
            }
            if (rows.length > 0) {
                console.log(data.infohash + ' exists.');
            } else {
                var stmt = infoDb.prepare("insert into torrent_info values(?,?,?,?,?)");
                stmt.run(data.infohash, data.name, data.magnet, data.totalLength, data.fetchedAt);
                stmt.finalize();

                infoDb.run("BEGIN TRANSACTION");

                data.files.forEach(function (file) {
                    infoDb.run("insert into torrent_detail values(?,?,?,?)", [data.infohash, file.path, file.length, data.fetchedAt]);
                });

                infoDb.run("END");

                crawledCount++;
                console.log('[' + new Date().toLocaleString() + ']' + '[' +crawledCount + ']' + data.name + ' saved.');
                /*
                var buf = encode_files(data.files);
                var stmt2 = fileDb.prepare("insert into torrent_files values(?,?)");
                stmt2.run(data.infohash, buf);
                stmt2.finalize(function() {
                    crawledCount++;
                    console.log('[' + new Date().toLocaleString() + ']' + '[' +crawledCount + ']' + data.name + ' saved.');
                });
                */
            }
        });
    });
}

create_tables();
p2p.listen(6881, '0.0.0.0');