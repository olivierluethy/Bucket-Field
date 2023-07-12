const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const port = 3000; // Choose an appropriate port

// Object to store selected fields for each player
const selectedFields = {};

// Object to store guessed fields for each player
const guessedFields = {};

io.on('connection', (socket) => {
  const playerId = socket.id; // Generate a unique ID for the player

  console.log(`Spieler mit ID ${playerId} hat eine Verbindung hergestellt.`);

  // Handle game events here
  socket.on('selectField', (fieldId) => {
    // Store the selected field for the player
    if (!selectedFields[playerId]) {
      selectedFields[playerId] = [];
    }
    selectedFields[playerId].push(fieldId);
  
    // Check if both players have finished selecting their fields
    const playerIds = Object.keys(selectedFields);
    if (playerIds.length === 2 && selectedFields[playerIds[0]].length === 10 && selectedFields[playerIds[1]].length === 10) {
      // Broadcast the selected fields to both players
      const player1Fields = selectedFields[playerIds[0]];
      const player2Fields = selectedFields[playerIds[1]];
      io.to(playerIds[0]).emit('opponentFields', player2Fields);
      io.to(playerIds[1]).emit('opponentFields', player1Fields);
    } else if (playerIds.length === 2 && selectedFields[playerId].length === 10) {
      // Emit an event to the player who has finished selecting
      socket.emit('waitForOpponent', playerId);
    } else {
      // Emit an event to the player who is still selecting
      socket.emit('continueSelection');
    }
  });  

  // Add more events to control the game
  socket.on('guessField', (fieldId) => {
    // Store the guessed field for the player
    if (!guessedFields[playerId]) {
      guessedFields[playerId] = [];
    }
    guessedFields[playerId].push(fieldId);
  
    // Check if the current player has found all 10 fields
    if (guessedFields[playerId].length === 10) {
      socket.emit('playerWin'); // Notify the player that they have won
      socket.broadcast.emit('opponentWin'); // Notify the opponent that the player has won
      // You can perform any additional actions here, such as ending the game or displaying a victory message
    } else {
      // The player has not yet found all 10 fields, continue the game
      socket.broadcast.emit('guessSelected', fieldId);
    }
  });

  socket.on("playerWin", () =>{
    alert("A player won this game!");
  })

  socket.on("playerReady", function(selectedFields) {
    if (selectedFields.length === 10) {
      socket.emit("playerComplete"); // Notify the server that the player has completed the selection
    }
  });
  
  socket.on("opponentReady", function(opponentSelectedFields) {
    if (opponentSelectedFields.length === 10) {
      socket.emit("opponentComplete"); // Notify the server that the opponent has completed the selection
    }
  });
  
  socket.on("playerComplete", function () {
    // Display a message or perform any actions to indicate that the player has completed the selection
    socket.emit("waitForOpponent", socket.id); // Notify the player to wait for the opponent
  });
  
  socket.on("opponentComplete", function () {
    // Display a message or perform any actions to indicate that the opponent has completed the selection
    socket.broadcast.emit("opponentComplete"); // Notify the opponent that the player has completed the selection
  });
  
  socket.on('disconnect', () => {
    console.log(`Spieler mit ID ${playerId} hat die Verbindung getrennt.`);
    // Remove the player's selected fields from the storage
    delete selectedFields[playerId];
  });
});

// Set up a static file server
app.use(express.static(path.join(__dirname, 'public')));

// Route handler for the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(port, () => {
  console.log(`Server is listening on port ${port}.`);
});