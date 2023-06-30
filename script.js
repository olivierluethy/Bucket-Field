function generateChessboard(boardId) {
    const board = document.getElementById(boardId);

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        board.appendChild(cell);
      }
    }
  }

  generateChessboard('board1');
  generateChessboard('board2');

  let selectForEnemyCounter = 0;

  document.getElementById("board1").addEventListener("contextmenu", function(event) {
    event.preventDefault(); // Prevent context menu from appearing
    if (event.target.classList.contains("cell")) {
      if (event.target.style.backgroundColor === "red") {
        event.target.style.backgroundColor = "white"; // Change color on right-click
        selectForEnemyCounter--;
      }else {
        alert("You can only change if it's selected!");
      }
    }
  });
  
  document.getElementById("board1").addEventListener("click", function(event) {
    if (event.target.classList.contains("cell")) {
      if (event.target.style.backgroundColor === "white" || event.target.style.backgroundColor === "") {
        if (event.which === 1 || event.button === 0) {
          if (selectForEnemyCounter < 10) {
            event.target.style.backgroundColor = "red"; // Change color on left-click
            selectForEnemyCounter++;
          } else {
            alert("You can't select more than 10!");
          }
        }
      } else if (event.target.style.backgroundColor === "red") {
        alert("This field has already been selected!");
      }
    }
  });
  