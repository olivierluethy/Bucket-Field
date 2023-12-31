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

const playerSockets = {};

let playerSelectedCount = {};

io.on('connection', (socket) => {
  const playerId = socket.id; // Generate a unique ID for the player

  // Spieler-ID und zugehörige Socket-ID speichern
  playerSockets[playerId] = socket;

  console.log(`Spieler mit ID ${playerId} hat eine Verbindung hergestellt.`);


  socket.on("send-field", (fieldId) => {
    // Broadcast the selected field to all other players
    // socket.broadcast.emit("receive-field", fieldId);
  
    // Store the selected field for the player
    if (!selectedFields[socket.id]) {
      selectedFields[socket.id] = [];
    }
    selectedFields[socket.id].push(fieldId);
    playerSelectedCount[socket.id]++;

    if (playerSelectedCount[socket.id] === 10) {
      socket.emit("playerReady");
    }
  
    console.log(socket.id + " selected: " + fieldId);
    console.log("Selected fields:", selectedFields[socket.id]);
  });

  socket.on("remove-field", (fieldId) => {
    // Remove the selected field for the player
    if (selectedFields[socket.id]) {
        const index = selectedFields[socket.id].indexOf(fieldId);
        if (index > -1) {
            selectedFields[socket.id].splice(index, 1);
            console.log(socket.id + " deletes: " + fieldId);
            console.log("Selected fields:", selectedFields[socket.id]);
            playerSelectedCount[socket.id]--;
        }
    }
})

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

  // socket.on("playerReady", function(selectedFields) {
  //   if (selectedFields.length === 10) {
  //     socket.emit("playerComplete"); // Notify the server that the player has completed the selection
  //   }
  // });
  socket.on("playerReady", () => {
    socket.emit("enableReadyButton", { playerId: socket.id });

    // Check if both players are ready
    const playerIds = Object.keys(selectedFields);
    if (playerIds.length === 2) {
      io.emit("playersReady"); // Notify both players that they are ready to start the game
    }
});

socket.on("playersReady", () => {
  // Perform any actions to start the game or display a message
  alert("Both players have completed the selection. The game is starting!");
});
  
  socket.on("opponentReady", function(opponentSelectedFields) {
    if (opponentSelectedFields.length === 10) {
      socket.emit("opponentComplete"); // Notify the server that the opponent has completed the selection
    }
  });
  
  socket.on("playerComplete", function() {
    // Display a message or perform any actions to indicate that the player has completed the selection
    socket.emit("sendAlert", { playerId: socket.id, message: "You have completed the selection\nYour opponent is still selecting!" });

    // Check if both players have completed the selection
    const playerIds = Object.keys(selectedFields);
    if (playerIds.length === 2) {
      // Both players have completed the selection, you can perform further actions here
    }
  });
  
  socket.on("opponentComplete", function () {
    // Display a message or perform any actions to indicate that the opponent has completed the selection
    socket.broadcast.emit("opponentComplete"); // Notify the opponent that the player has completed the selection
  });
  
  socket.on('disconnect', () => {
    console.log(`Spieler mit ID ${playerId} hat die Verbindung getrennt.`);
    // Remove the player's selected fields from the storage
    delete playerSockets[playerId];
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