const path = require('path');
const cors = require('cors');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const socketIO = require('socket.io')(http, {
  cors: {
    origin: "*",
  }
});

const PORT = process.env.PORT || 4000;

const buildPath = path.join(__dirname, '..', 'build');
app.use(express.static(buildPath));
app.use(cors());

app.get("/api", (req, res) => {
  res.json({ message: "Hello from server" });
});

let connectedUsers = [];
let activeRooms = [];
let users = [];

socketIO.on('connection', (socket) => {
  console.log(`⚡: ${socket.id} user just connected!`);
  users.push({socket:socket,id:socket.id});

  // Add the new user to the connected users list
  connectedUsers.push({ id: socket.id, name: "User " + socket.id });

  // Send the updated user list to all clients
  socketIO.emit('user connected', connectedUsers);

  socket.emit('current user', { id: socket.id, name: `User ${socket.id}` });
  socket.on('disconnect', () => {
    // console.log(`🔥: User ${socket.id} disconnected`);

    // Remove the disconnected user from the connected users list
    connectedUsers = connectedUsers.filter((user) => user.id !== socket.id);

    // Send the updated user list to all clients
    socketIO.emit('user disconnected', socket.id);
  });

  socket.on('challenge', (opponentId, currentUser) => {
    // Send a message to the challenged user
    socket.to(opponentId).emit('challenged', currentUser);

  })

  socket.on('spell', (roomId, spell, spellAnimation, currentUser) => {
    // Send a message to the challenged user
    socketIO.to(roomId).emit('spell', spell, spellAnimation, currentUser);
  });

  socket.on('join',(room) => {
    socket.join(room);
  })

  socket.on('challenge user', (opponentId) => {
    console.log(`User ${socket.id} challenged user ${opponentId}`);

    let user_index = users.findIndex(user => user.id == opponentId);
    let socketB = users[user_index].socket;
    // Create a new room with the two players
    const roomId = `${socket.id}${opponentId}`;
    activeRooms.push({roomId,player1: {id:socket.id, hp:8, spell:null, spellAnimation:null,ready:false,hit:false},player2:{id:opponentId, hp:8, spell:null, spellAnimation:null,ready:false,hit:false}});

    // Send each player to the room
    socket.join(roomId);
    socketB.join(roomId);

    // Send a message to both players indicating the room they are in
    // socket.emit('room created', roomId);
    socketIO.to(roomId).emit('room created',roomId);

    // socket.to(opponentId).emit('room created', roomId);
  });



  // ============== GAME LOGIC ==============

  socket.on('playerReady',(user,roomId) => {
    console.log(activeRooms);
    let room_index = activeRooms.findIndex(room => room.roomId == roomId);
    if(activeRooms[room_index].player1.id == user.id){
      activeRooms[room_index].player1.ready = true;
      activeRooms[room_index].player1.hp = user.hp;
      activeRooms[room_index].player1.spell = user.spell;
      activeRooms[room_index].player1.spellAnimation = user.spellAnimation;
    }else{
      activeRooms[room_index].player2.ready = true;
      activeRooms[room_index].player2.hp = user.hp;
      activeRooms[room_index].player2.spell = user.spell;
      activeRooms[room_index].player2.spellAnimation = user.spellAnimation;
    }

    let player1 = activeRooms[room_index].player1;
    let player2 = activeRooms[room_index].player2;

    if(player1.ready && player2.ready){
      if(player1.spell == player2.spell){
      }else if(player1.spell === 'attack' && player2.spell === 'transfigurate' || player1.spell === 'defence' && player2.spell === 'attack' || player1.spell === 'transfigurate' && player2.spell === 'defence'){
        player2.hp -= 2;
        player2.hit = true;
      }else if(player1.spell === 'attack' && player2.spell === 'defence' || player1.spell === 'defence' && player2.spell === 'transfigurate' || player1.spell === 'transfigurate' && player2.spell === 'attack'){
        player1.hp -= 2;
        player1.hit = true;
      }
      activeRooms[room_index].player1 = player1;
      activeRooms[room_index].player2 = player2;
      socketIO.to(roomId).emit('gameStart',player1,player2);
      activeRooms[room_index].player1.ready = false;
      activeRooms[room_index].player2.ready = false;
      activeRooms[room_index].player1.hit = false;
      activeRooms[room_index].player2.hit = false;
    }
  });

  socket.on('leave room', (roomId) => {
    // console.log(`User ${socket.id} left room ${roomId}`);

    // Remove the room from the active rooms list
    activeRooms = activeRooms.filter((room) => room !== roomId);

    // Leave the room
    socket.leave(roomId);

    // Send a message to all players in the room that the user left
    socket.to(roomId).emit('user left', socket.id);
  });
});

http.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
