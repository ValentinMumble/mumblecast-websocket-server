var mysql = require("mysql");

/* Start server on port 3000. */
var io = require("socket.io").listen(3000);

/* Connect to MySQL. */
var db = mysql.createConnection({
  host: "54.187.163.215",
  user: "mumble",
  password: "v4l3xenforce",
  database: "mumblecast"
});

db.connect(function(err){
  if (err) console.log(err);
});

var tracks = [];
var isInitTracks = false;
var clientsCount = 0;
var receiver = null;

var indexOfTrack = function(id) {
  for (var i = 0; i < tracks.length; i++) {
    if (tracks[i].id == id) {
      return i;
    }
  }
  return -1;
};

var deleteTrack = function(id) {
  var i = indexOfTrack(id);
  if (i) tracks.splice(i, 1);
  return i;
};

io.sockets.on("connection", function(socket) {
  
  socket.on("disconnect", function() {
    if (socket == receiver) {
      receiver = null;
      io.sockets.emit("receiver disconnected");
    } else {
      clientsCount--;
      io.sockets.emit("clients connected", clientsCount);
    }
  });
  
  socket.on("hello", function() {
    clientsCount++;
    /* Tell all sockets how many are connected. */
    io.sockets.emit("clients connected", clientsCount);
  });

  socket.on("new track", function(data) {
    /* New track added, push to all sockets and insert into db. */
    var trackObject = {provider: data.provider, trackId: data.trackId};
    db.query("INSERT INTO tracks SET ?", trackObject, function(err, info) {
      if (!err) {
        trackObject.id = info.insertId;
        tracks.push(trackObject);
        io.sockets.emit("new track", trackObject);
      } else {
        console.log(err);
      }
    });
  });

  socket.on("delete track", function(id) {
    db.query("DELETE FROM tracks WHERE id=?", id, function(err, info) {
      if (!err) {
        deleteTrack(id);
        io.sockets.emit("delete track", id);
      } else {
        console.log(err);
      }
    });
  });

  socket.on("i am receiver", function() {
    receiver = socket;
    receiver.broadcast.emit("receiver connected");
  });

  socket.on("play track", function(id) {
    if (receiver != null) {
      receiver.emit("play track", id);
    }
  });
  
  socket.on("track playing", function(id) {
    socket.broadcast.emit("track playing", id);
  });

  /* Check to see if initial query/tracks are set. */
  if (!isInitTracks) {
    /* Initial app start, run db query. */
    db.query("SELECT * FROM tracks")
    .on("result", function(data){
      tracks.push(data);
    })
    .on("end", function(){
      /* Only emit tracks after query has been completed. */
      socket.emit("initial tracks", tracks);
    });
    isInitTracks = true;
  } else {
    socket.emit("initial tracks", tracks);
  }
});
