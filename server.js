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
    }
  });

  // Add more events to control the game
  socket.on('guessField', (fieldId) => {
    socket.broadcast.emit('guessSelected', fieldId);
  })

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