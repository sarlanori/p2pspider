function toArrayBuffer(buf) {
    var ab = new ArrayBuffer(buf.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buf.length; i++) {
        view[i] = buf[i]
    }
    return ab;
}

function toBuffer(ab) {
    var buf = new Buffer(ab.byteLength);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buf.length; i++) {
        buf[i] = view[i];
    }
    return buf;
}
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('torrent.db');

db.serialize(function () {
    db.all('select * from torrent_info limit 2', function (err, rows) {
        if (err) {
            console.log('Save metadata failed: ' + err);
            return;
        }
        if (rows.length > 0) {
            //const fs = require('fs');
            //const file = fs.createWriteStream('example.txt');
            for (var i = 0; i < rows.length; i++) {
                var buf = rows[i].files_info;
                //var path = buf.toString('utf8', 0, buf.length - 4);
                //var length = buf.readUInt32BE(buf.length - 4);
                var offset = 0;
                while (offset < buf.length) {
                    var pathLen = buf.readInt32LE(offset);
                    offset += 4;
                    var path = buf.toString('utf8', offset, offset + pathLen);
                    offset += pathLen;
                    var fileLen = buf.readDoubleLE(offset);
                    offset += 8;

                    //console.log(pathLen);
                    console.log(path);
                    console.log(fileLen);
                    console.log("===================");
                }

                //file.write(path);
                //file.write(length.toString());
            };
            //file.end();
        }
    });
});