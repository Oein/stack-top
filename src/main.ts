import "./style.css";
import Two from "two.js";

import Leaderboard from "./leaderboardSystem";
import notifier from "./notifier";

const LDBoard = Leaderboard({
  getGameRunning() {
    return gameState.isPlaying;
  },
  kvAPIKey: "stack-top",
  notifier: notifier,
});

(window as any).lb = LDBoard;

let plname: string | null = null;
const namePrompt = () => {
  if (plname != null) return plname;
  const name = prompt(
    "이름을 입력하세요 (영어 소문자, 숫자, _, - 만 가능, 최대 10자)"
  );
  if (!name) return null;
  if (name.length > 10) {
    alert("이름이 너무 깁니다. 최대 10자까지 가능합니다.");
    return namePrompt();
  }
  if (!/^[a-z0-9_-]+$/.test(name)) {
    alert("이름에 허용되지 않는 문자가 포함되어 있습니다.");
    return namePrompt();
  }
  plname = name;
  return name;
};

// Game Constants
const GAME_WIDTH = 400;
const BLOCK_HEIGHT = 30;
const INITIAL_BLOCK_WIDTH = 100;
const MIN_SPEED = 300; // pixels per second
const MAX_SPEED = 800; // pixels per second

// Game State
interface Block {
  rect: any;
  x: number;
  y: number;
  width: number;
  direction: 1 | -1;
  speed: number;
}

const gameState = {
  isPlaying: false,
  score: 0,
  blocks: [] as Block[],
  currentBlock: null as Block | null,
  gameOver: false,
  cameraY: 0, // Camera offset for scrolling
};

// Two.js Setup
const two = new Two({
  width: GAME_WIDTH,
  height: window.innerHeight,
  autostart: true,
}).appendTo(document.getElementById("app")!);

// Score Text
const scoreText = two.makeText("1", GAME_WIDTH / 2, window.innerHeight / 2);
scoreText.size = 120;
scoreText.fill = "#000000";
scoreText.opacity = 0.2;
scoreText.family = "Arial, sans-serif";
scoreText.weight = 900;

// Colors
const COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B88B",
  "#FAD7A1",
];

function getColor(index: number): string {
  return COLORS[index % COLORS.length];
}

function createBlock(
  x: number,
  y: number,
  width: number,
  speed: number,
  direction: 1 | -1
): Block {
  const rect = two.makeRectangle(x, y - gameState.cameraY, width, BLOCK_HEIGHT);
  rect.fill = getColor(gameState.blocks.length);
  rect.noStroke();

  return {
    rect,
    x,
    y,
    width,
    direction,
    speed,
  };
}

let startAt = 0;
function initGame() {
  // Clear previous blocks only
  gameState.blocks.forEach((block) => two.remove(block.rect));
  if (gameState.currentBlock) {
    two.remove(gameState.currentBlock.rect);
  }

  gameState.blocks = [];
  gameState.currentBlock = null;
  gameState.score = 0;
  gameState.gameOver = false;
  gameState.isPlaying = true;
  gameState.cameraY = 0;

  startAt = Date.now();

  // Create base block at bottom + 100px
  const baseBlock = createBlock(
    GAME_WIDTH / 2,
    two.height - 100 - BLOCK_HEIGHT / 2,
    INITIAL_BLOCK_WIDTH,
    0,
    1
  );
  gameState.blocks.push(baseBlock);
  gameState.score = 1; // Base block counts as first block

  // Create first moving block
  spawnNewBlock();

  updateScoreDisplay();
}

function spawnNewBlock() {
  const lastBlock = gameState.blocks[gameState.blocks.length - 1];
  const newY = lastBlock.y - BLOCK_HEIGHT;
  // Random speed for each block
  const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);

  const newBlock = createBlock(
    0,
    newY,
    lastBlock.width,
    speed,
    Math.random() > 0.5 ? 1 : -1
  );

  gameState.currentBlock = newBlock;
}

function updateBlock(block: Block, deltaTime: number) {
  if (!block) return;

  // Update position based on delta time (deltaTime is in seconds)
  block.x += block.direction * block.speed * deltaTime;

  // Bounce off edges
  const halfWidth = block.width / 2;
  if (block.x - halfWidth <= 0) {
    block.x = halfWidth;
    block.direction = 1;
  } else if (block.x + halfWidth >= GAME_WIDTH) {
    block.x = GAME_WIDTH - halfWidth;
    block.direction = -1;
  }

  // Update rectangle position with camera offset
  block.rect.translation.set(block.x, block.y - gameState.cameraY);
}

function stackBlock() {
  if (!gameState.currentBlock || gameState.gameOver) return;

  const currentBlock = gameState.currentBlock;
  const lastBlock = gameState.blocks[gameState.blocks.length - 1];

  // Calculate overlap
  const currentLeft = currentBlock.x - currentBlock.width / 2;
  const currentRight = currentBlock.x + currentBlock.width / 2;
  const lastLeft = lastBlock.x - lastBlock.width / 2;
  const lastRight = lastBlock.x + lastBlock.width / 2;

  const overlapLeft = Math.max(currentLeft, lastLeft);
  const overlapRight = Math.min(currentRight, lastRight);
  const overlapWidth = overlapRight - overlapLeft;

  if (overlapWidth <= 0) {
    // Game Over - no overlap
    endGame();
    return;
  }

  // Create new static block with overlapped area
  const newX = (overlapLeft + overlapRight) / 2;
  const newBlock = createBlock(newX, currentBlock.y, overlapWidth, 0, 1);

  // Remove current block
  two.remove(currentBlock.rect);

  // Add new block to stack
  gameState.blocks.push(newBlock);
  gameState.score++;
  updateScoreDisplay();

  // Spawn next block
  spawnNewBlock();
}

function endGame() {
  gameState.gameOver = true;
  gameState.isPlaying = false;

  // Stop current block if exists
  if (gameState.currentBlock) {
    two.remove(gameState.currentBlock.rect);
    gameState.currentBlock = null;
  }

  // Show game over
  const playerName = namePrompt();
  if (playerName) {
    const t = (Date.now() - startAt) / 1000;
    const txt = t.toFixed(2) + "s";
    LDBoard.saveScore(playerName, gameState.score, txt);
  }
}

function updateScoreDisplay() {
  document.title = `Stack - Score: ${gameState.score}`;
  scoreText.value = gameState.score.toString();
}

// Game Loop
let lastTime = performance.now();

two.bind("update", () => {
  if (!gameState.isPlaying || gameState.gameOver) return;

  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;

  // Update current moving block
  if (gameState.currentBlock) {
    updateBlock(gameState.currentBlock, deltaTime);
  }

  // Update camera to keep top block centered
  const topBlock =
    gameState.currentBlock || gameState.blocks[gameState.blocks.length - 1];
  if (topBlock) {
    const targetCameraY = topBlock.y - two.height / 2;
    // Smooth camera movement with lerp (interpolation)
    const lerpFactor = 1 - Math.pow(0.001, deltaTime); // Smooth interpolation
    gameState.cameraY += (targetCameraY - gameState.cameraY) * lerpFactor;

    // Update all block positions and remove offscreen blocks
    gameState.blocks = gameState.blocks.filter((block) => {
      const screenY = block.y - gameState.cameraY;
      if (screenY > two.height + 100) {
        // Block is below screen, remove it
        two.remove(block.rect);
        return false;
      }
      block.rect.translation.set(block.x, screenY);
      return true;
    });

    if (gameState.currentBlock) {
      gameState.currentBlock.rect.translation.set(
        gameState.currentBlock.x,
        gameState.currentBlock.y - gameState.cameraY
      );
    }
  }
});

// Input Handling
function handleInput() {
  if (gameState.gameOver) {
    initGame();
  } else {
    stackBlock();
  }
}

window.addEventListener("click", handleInput);
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    handleInput();
  }
});

// Handle window resize
window.addEventListener("resize", () => {
  two.height = window.innerHeight;
  scoreText.translation.set(GAME_WIDTH / 2, window.innerHeight / 2);
});

// Start the game
initGame();
