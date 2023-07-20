const socket = io();
const playerName = localStorage.getItem("playerName");
const opponentName = localStorage.getItem("opponentName");

function generateChessboard(boardId) {
  const board = document.getElementById(boardId);
  var cellCounter = 1;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      const cellId = cellCounter++; // Generate a unique ID for each cell
      cell.id = cellId; // Set the ID of the cell
      board.appendChild(cell);
    }
  }
}

generateChessboard("board1");
generateChessboard("board2");

let selectForEnemyCounter = 0;
let selectedFields = [];
let correctGuessesPlayer = 0;
let correctGuessesOpponent = 0;
let countdownStarted = false;

socket.on("waitForOpponent", (playerId) => {
  if (playerId === socket.id) {
    alert("Wait for the opponent to finish selecting fields");
  }
});

socket.on("continueSelection", () => {
  // Opponent is still selecting fields, continue the game
});

socket.on("opponentComplete", () => {
  // Opponent has completed the field selection
  alert("Your opponent has completed the field selection!");
});

socket.on("playerComplete", () => {
  // Player has completed the field selection
  alert("You have completed the field selection!");
});

socket.on("opponentFields", (opponentSelectedFields) => {
  // ... your code for handling opponent's selected fields ...
});

socket.on("opponentWin", () => {
  // Opponent has won the game
  alert("Your opponent has won the game!");
});

socket.on("playerWin", () => {
  // Player has won the game
  alert("You have won the game!");
});

document
  .getElementById("board1")
  .addEventListener("contextmenu", function (event) {
      event.preventDefault(); // Prevent context menu from appearing
      if (event.target.classList.contains("cell")) {
        if (event.target.style.backgroundColor === "red") {
          event.target.style.backgroundColor = "white"; // Change color on right-click
          selectForEnemyCounter--;
          socket.emit('remove-field', event.target.id); // Remove ID from selectedFields array);
        } else {
          alert("You can only change if it's selected!");
        }
      }
  });

  document.getElementById("board1").addEventListener("click", function (event) {
    if (event.target.classList.contains("cell")) {
        if (event.target.style.backgroundColor === "white" || event.target.style.backgroundColor === "") {
            if (event.which === 1 || event.button === 0) {
                if (selectForEnemyCounter < 10) {
                    event.target.style.backgroundColor = "red"; // Change color on left-click
                    event.target.style.transform = "scale(1)";
                    selectForEnemyCounter++;
                    selectedFields.push(event.target.id); // Add ID of field to selectedFields array

                    socket.emit('send-field', event.target.id);

                    if (selectForEnemyCounter === 10) {

                        socket.emit("playerReady", selectedFields); // When player already select 10 he must wait for the other

                        readyButton.disabled = false; // Enable the button
                        const cells = document.querySelectorAll("#board2 .cell");
                        for (let i = 0; i < cells.length; i++) {
                            cells[i].textContent = ""; // Clear the content (X) of each cell
                        }
                        console.log("Selected fields:", selectedFields);
                        socket.emit("selectField", selectedFields); // Send the selected fields to the server
                    }
                } else {
                    alert("You can't select more than 10!\nPress ready if you don't want to make a change.");
                }
            }
        } else if (event.target.style.backgroundColor === "red") {
            alert("This field has already been selected!");
        }
    }
});

let countdownTimer;

function startCountdown() {
  let timeLeft = 10;
  countdownTimer = setInterval(() => {
      document.getElementById("countdown").textContent = timeLeft;
      document.getElementById("readyButton").style.backgroundColor="white";
      timeLeft--;
      if (timeLeft < 0) {
          clearInterval(countdownTimer);
          // Time is up, do something here
          // Remove the player's selected fields from the storage
          // alert("AFK Timeout!")
          // location.reload();
      }
  }, 1000);
}

// Button for the player to indicate readiness
let readyButton = document.getElementById("readyButton");
readyButton.addEventListener("click", () => {
  if (!countdownStarted) {
    countdownStarted = true;
    startCountdown();
  }
  const fieldGray = document.querySelectorAll("#board1 .cell");
  for (let i = 0; i < fieldGray.length; i++) {
    if (fieldGray[i].style.backgroundColor === "red") {
      fieldGray[i].style.backgroundColor = "gray"; // Change color to gray
    }
  }
});

socket.on("waitForPlayer", (playerId) => {
  if (playerId === socket.id) {
    alert("Wait for the other player to finish");
  }
});

document.getElementById("board2").addEventListener("click", function (event) {
  if (selectForEnemyCounter === 10) {
    if (event.target.classList.contains("cell")) {
      const clickedCellId = String(event.target.id); // Convert to string
      // If it has already been selected
      if (
        event.target.style.backgroundColor === "black" ||
        event.target.style.backgroundColor === "gold"
      ) {
        alert("You have already selected it");
      }
      // If it has not been selected
      else {
        socket.emit("guessField", clickedCellId); // Send the guessed cell ID to the server
      }
    }
  }
});

socket.on("sendAlert", function(data) {
  if (data.playerId === socket.id) {
    alert(data.message);
  }
});

socket.on("enableReadyButton", function(data){
  if (data.playerId === socket.id){
    document.getElementById("readyButton").disabled = false;
    document.getElementById("readyButton").style.cursor ="pointer";
    document.getElementById("readyButton").style.backgroundColor ="white";
  }
})

function stopCountdown() {
  clearInterval(countdownTimer);
  document.getElementById("countdown").textContent = "";
}

socket.on("opponentFields", function (opponentSelectedFields) {
  console.log("Opponent selected fields:", opponentSelectedFields);
});

socket.on("guessSelected", function (guess) {
  const board1Cells = document.querySelectorAll("#board1 .cell");
  for (var i = 0; i < board1Cells.length; i++) {
    if (board1Cells[i].id === guess.fieldId) {
      if (selectedFields.includes(guess.fieldId)) {
        correctGuessesOpponent++;
        board1Cells[i].style.backgroundColor = "gold";
        if (correctGuessesOpponent === 10) {
          alert("Opponent won the game!");
          restartGame();
        }
      } else {
        board1Cells[i].style.backgroundColor = "royalblue";
      }
      break; // Exit the loop since the cell has been found
    }
  }
});

function restartGame() {
  location.reload();
}