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
var clients = [];
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

io.sockets.on("connection", function(socket) {

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
    var index = receivers.indexOf(socket.id);
    if (index != -1) {
      receivers.splice(index, 1);
      if (receivers.length == 0) {
        io.sockets.emit("receiver disconnected");
        current.paused = true;
        io.sockets.emit("paused", current.paused);
      }
    } else {
      index = clients.indexOf(socket.id);
      if (index != -1) {
        clients.splice(index, 1);
        io.sockets.emit("clients connected", clients.length);
      }
    }
  });
  
  /* ------ Client { ------ */

  socket.on("hello", function() {
    clients.push(socket.id);
    io.sockets.emit("clients connected", clients.length);
    if (current.index != null) {
      /* Tell this socket what track is playing & if it's paused. */
      socket.emit("track playing", current.index);
      socket.emit("paused", current.paused);
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
    io.sockets.emit("play track", id);
  });
  
  /* When a client wants to play the next track. */
  socket.on("next", function() {
    io.sockets.emit("next");
  });
  
  /* When a client wants to play the previous track. */
  socket.on("previous", function() {
    io.sockets.emit("previous");
  });
  
  /* When a client wants to pause the current track. */
  socket.on("pause", function() {
    /* We actually pause/unpause the track only if at least one receiver is connected. */
    if (receivers.length > 0) {
      current.paused = !current.paused;
      /* Notify everyone that the current track is paused. */
      io.sockets.emit("paused", current.paused);
    }
  });
  
  /* ------ } Client ------ */
  
  /* ------ Receiver { ------ */
  
  /* When a receiver introduces itself. */
  socket.on("i am receiver", function() {
    /* Store the receiver and broadcast to others that a new receiver is connected. */
    receivers.push(socket.id);
    socket.broadcast.emit("receiver connected");
  });

  /* When a receiver notifies that this track is playing. */
  socket.on("track playing", function(id) {
    /* Store the current index and brodcast to others that this track is playing. */
    current.index = id;
    socket.broadcast.emit("track playing", current.index);
    /* Broadcast to others that the track is not paused. */
    current.paused = false;
    socket.broadcast.emit("paused", current.paused);
  });
  
  /* ------ } Receiver ------ */
});
