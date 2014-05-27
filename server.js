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
var receivers = [];
var current = {index: null, paused: true};

var indexOfTrack = function(id) {
  for (var i = 0; i < tracks.length; i++) {
    if (tracks[i].id == id) return i;
  }
  return -1;
};

var deleteTrack = function(id) {
  var i = indexOfTrack(id);
  if (i) tracks.splice(i, 1);
  return i;
};

var emitToReceivers = function(event, data) {
  for (var i = 0; i < receivers.length; i++) {
    receivers[i].emit(event, data);
  }
};

io.sockets.on("connection", function(socket) {

  clientsCount++;
  
  /* Check if initial query/tracks are set. */
  if (!isInitTracks) {
    /* Initial app start, run db query. */
    db.query("SELECT * FROM tracks")
    .on("result", function(data){
      tracks.push(data);
    })
    .on("end", function(){
      socket.emit("initial tracks", tracks);
    });
    isInitTracks = true;
  } else {
    socket.emit("initial tracks", tracks);
  }
  
  /* When a socket disconnects. */
  socket.on("disconnect", function() {
    console.log(receivers.indexOf(socket));
    if (receivers.indexOf(socket)) {
      io.sockets.emit("receiver disconnected");
    } else {
      clientsCount--;
      io.sockets.emit("clients connected", clientsCount);
    }
  });
  
  /* ------ Client { ------ */

  socket.on("hello", function() {
    io.sockets.emit("clients connected", clientsCount);
    if (current.index != null) {
      io.sockets.emit("track playing", current.index);
      io.sockets.emit("paused", current.paused);
    }
  });

  /* When a client submits a valid track. */
  socket.on("new track", function(data) {
    db.query("INSERT INTO tracks SET ?", data, function(err, info) {
      if (!err) {
        data.id = info.insertId;
        tracks.push(data);
        io.sockets.emit("track added", data);
      } else {
        console.log(err);
      }
    });
  });

  /* When a client deletes a track. */
  socket.on("delete track", function(id) {
    db.query("DELETE FROM tracks WHERE id=?", id, function(err, info) {
      if (!err) {
        deleteTrack(id);
        io.sockets.emit("track deleted", id);
      } else {
        console.log(err);
      }
    });
  });

  /* When a client wants to play a track. */
  socket.on("play track", function(id) {
    emitToReceivers("play track", id);
  });

  /* When a client wants to pause the current track. */
  socket.on("pause", function() {
    emitToReceivers("pause");
  });
  
  /* When a client wants to play the next track. */
  socket.on("next", function() {
    emitToReceivers("next");
  });
  
  /* When a client wants to play the previous track. */
  socket.on("previous", function() {
    emitToReceivers("previous");
  });
  
  /* ------ } Client ------ */
  
  /* ------ Receiver { ------ */
  
  /* When a receiver introduces itself. */
  socket.on("i am receiver", function() {
    receivers.push(socket);
    clientsCount--;
    io.sockets.emit("receiver connected");
    io.sockets.emit("clients connected", clientsCount);
  });

  /* When a receiver notifies that the current track is paused or not. */
  socket.on("paused", function(paused) {
    current.paused = paused;
    socket.broadcast.emit("paused", current.paused);
  });
  
  /* When a receiver notifies that this track is playing. */
  socket.on("track playing", function(id) {
    current.index = id;
    socket.broadcast.emit("track playing", current.index);
  });
  
  /* ------ } Receiver ------ */
});
