function generateChessboard(boardId) {
    const board = document.getElementById(boardId);
    var cellCounter = 1;
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            const cellId = cellCounter++; // Generate a unique ID for each cell
            cell.id = cellId; // Set the ID of the cell
            board.appendChild(cell);
        }
    }
}

generateChessboard('board1');
generateChessboard('board2');

let selectForEnemyCounter = 0;
let selectedFields = [];
var botNumbers = [];
let correctGuessesBot = 0;
let correctGuessesPlayer = 0;
var guessedNumbersByBot = [];

document.addEventListener('DOMContentLoaded', function() {
    const cells = document.querySelectorAll("#board2 .cell");
    for (let i = 0; i < cells.length; i++) {
        cells[i].textContent = "X"; // Add the content (X) to each cell
    }

    botNumbers = generatebotNumbers(1, 100, 10).map(String);
    console.log("Bot Numbers " + botNumbers);
});

document.getElementById("board1").addEventListener("contextmenu", function(event) {
    if (selectForEnemyCounter !== 10) {
        event.preventDefault(); // Prevent context menu from appearing
        if (event.target.classList.contains("cell")) {
            if (event.target.style.backgroundColor === "red") {
                event.target.style.backgroundColor = "white"; // Change color on right-click
                selectForEnemyCounter--;
                const index = selectedFields.indexOf(event.target.id);
                if (index !== -1) {
                    selectedFields.splice(index, 1); // Remove ID from selectedFields array
                }
            } else {
                alert("You can only change if it's selected!");
            }
        }
    }
});

document.getElementById("board1").addEventListener("click", function(event) {
    if (selectForEnemyCounter !== 10) {
        if (event.target.classList.contains("cell")) {
            if (event.target.style.backgroundColor === "white" || event.target.style.backgroundColor === "") {
                if (event.which === 1 || event.button === 0) {
                    if (selectForEnemyCounter < 10) {
                        event.target.style.backgroundColor = "red"; // Change color on left-click
                        event.target.style.transform = 'scale(1)';
                        selectForEnemyCounter++;
                        selectedFields.push(event.target.id); // Add ID of field to selectedFields array
                        if (selectForEnemyCounter === 10) {
                            const cells = document.querySelectorAll("#board2 .cell");
                            for (let i = 0; i < cells.length; i++) {
                                cells[i].textContent = ""; // Clear the content (X) of each cell
                            }
                            const fieldGray = document.querySelectorAll("#board1 .cell");
                            for (let i = 0; i < fieldGray.length; i++) {
                                if (fieldGray[i].style.backgroundColor === "red") {
                                    fieldGray[i].style.backgroundColor = "gray"; // Change color to gray
                                }
                            }
                            console.log("Selected fields:", selectedFields);
                        }
                    } else {
                        alert("You can't select more than 10!");
                    }
                }
            } else if (event.target.style.backgroundColor === "red") {
                alert("This field has already been selected!");
            }
        }
    } else {
        alert("You can't make any changes!");
    }
});

document.getElementById("board2").addEventListener("click", function(event) {
    if (selectForEnemyCounter === 10) {
        if (event.target.classList.contains("cell")) {
            const clickedCellId = String(event.target.id); // Convert to string
            // If it has already been selected
            if(event.target.style.backgroundColor === "black" || event.target.style.backgroundColor === "gold"){
                alert("You have already selected it")
            }
            // If it has not been selected
            else {
                // Check if player guessed correctly
                if (botNumbers.includes(clickedCellId)) {
                    event.target.style.backgroundColor = "gold"; // Change color on left-click
                    alert("You got one!");
                    correctGuessesPlayer++;
                    if(correctGuessesPlayer == 10){
                        alert("You won the game!");
                        restartGame();
                    }
                } else {
                    event.target.style.backgroundColor = "black"; // Change color on left-click
                }
                var botNumber = botGuess(1, 100);
                // Check if bot guessed correctly
                var isGuessCorrect = selectedFields.includes(String(botNumber)); // Convert botNumber to string for comparison

                var board1Cells = document.querySelectorAll("#board1 .cell");
                for (var i = 0; i < board1Cells.length; i++) {
                    if (board1Cells[i].id === String(botNumber)) {
                        if (isGuessCorrect) {
                            correctGuessesBot++;
                            board1Cells[i].style.backgroundColor = "gold";
                            if(correctGuessesBot == 10){
                                alert("Bot won the game!");
                                restartGame();
                            }
                        } else {
                            board1Cells[i].style.backgroundColor = "royalblue";
                        }
                        break; // Exit the loop since the cell has been found
                    }
                }
            }
        }
    }
});

function botGuess(min, max) {
    var guessNumber = 0;

    if (guessedNumbersByBot.length === 0) {
        guessNumber = Math.floor(Math.random() * (max - min + 1)) + min;
        guessedNumbersByBot.push(guessNumber);
        return guessNumber;
    } else {
        do {
            guessNumber = Math.floor(Math.random() * (max - min + 1)) + min;
        } while (guessedNumbersByBot.includes(guessNumber));

        guessedNumbersByBot.push(guessNumber);
        console.log("Bot Guess: " + guessNumber);
        return guessNumber;
    }
}

function generatebotNumbers(min, max, count) {
    var numbers = [];

    while (numbers.length < count) {
        var randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

        if (!numbers.includes(randomNumber)) {
            numbers.push(randomNumber);
        }
    }

    return numbers;
}

function restartGame() {
    location.reload();
}