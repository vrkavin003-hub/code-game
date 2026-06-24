// ===========================
// GAME CONFIGURATION
// ===========================

const CONFIG = {
    canvas: {
        width: 1200,
        height: 600,
    },
    player: {
        width: 30,
        height: 40,
        jumpPower: 15,
        moveSpeed: 5,
        gravity: 0.6,
        groundY: 520,
    },
    difficulty: {
        easy: { speedMultiplier: 0.7, spawnRate: 0.01, lives: 4 },
        normal: { speedMultiplier: 1, spawnRate: 0.015, lives: 3 },
        hard: { speedMultiplier: 1.3, spawnRate: 0.02, lives: 2 },
    },
    colors: {
        player: '#00d4ff',
        playerGlow: 'rgba(0, 212, 255, 0.8)',
    },
};

// ===========================
// GAME STATE MANAGER
// ===========================

const gameState = {
    currentScreen: 'loading',
    gameMode: 'endless', // 'endless' or 'mission'
    score: 0,
    highScore: localStorage.getItem('codeRunnerHighScore') || 0,
    distance: 0,
    tokensCollected: 0,
    level: 1,
    lives: 3,
    gameSpeed: 5,
    isPaused: false,
    soundEnabled: localStorage.getItem('codeRunnerSound') !== 'false',
    particlesEnabled: localStorage.getItem('codeRunnerParticles') !== 'false',
    difficulty: localStorage.getItem('codeRunnerDifficulty') || 'normal',
    theme: localStorage.getItem('codeRunnerTheme') || 'blue',
    activePowerUp: null,
    powerUpTimer: 0,
    screenShaking: 0,
    missionProgress: {
        type: null,
        target: 0,
        current: 0,
    },
};

// ===========================
// CANVAS & CONTEXT SETUP
// ===========================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const aspectRatio = CONFIG.canvas.width / CONFIG.canvas.height;
    
    let width = rect.width;
    let height = rect.height;
    
    if (width / height > aspectRatio) {
        width = height * aspectRatio;
    } else {
        height = width / aspectRatio;
    }
    
    canvas.width = CONFIG.canvas.width;
    canvas.height = CONFIG.canvas.height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ===========================
// GAME OBJECTS
// ===========================

class Player {
    constructor() {
        this.x = 100;
        this.y = CONFIG.player.groundY;
        this.width = CONFIG.player.width;
        this.height = CONFIG.player.height;
        this.velocityY = 0;
        this.isJumping = false;
        this.canDoubleJump = true;
        this.isSliding = false;
        this.slideDuration = 0;
        this.shieldActive = false;
        this.shieldTime = 0;
        this.magnetActive = false;
        this.magnetTime = 0;
        this.magneticRange = 150;
        this.slowMotionActive = false;
        this.slowMotionTime = 0;
        this.scoreMultiplier = 1;
        this.scoreMultiplierTime = 0;
        this.damageFlash = 0;
    }

    update() {
        // Apply gravity
        this.velocityY += CONFIG.player.gravity;
        this.y += this.velocityY;

        // Ground collision
        if (this.y >= CONFIG.player.groundY) {
            this.y = CONFIG.player.groundY;
            this.velocityY = 0;
            this.isJumping = false;
            this.canDoubleJump = true;
        }

        // Update power-ups
        if (this.shieldActive) {
            this.shieldTime--;
            if (this.shieldTime <= 0) {
                this.shieldActive = false;
                playSound('powerUpEnd');
            }
        }

        if (this.magnetActive) {
            this.magnetTime--;
            if (this.magnetTime <= 0) {
                this.magnetActive = false;
                playSound('powerUpEnd');
            }
        }

        if (this.slowMotionActive) {
            this.slowMotionTime--;
            if (this.slowMotionTime <= 0) {
                this.slowMotionActive = false;
            }
        }

        if (this.scoreMultiplier > 1) {
            this.scoreMultiplierTime--;
            if (this.scoreMultiplierTime <= 0) {
                this.scoreMultiplier = 1;
            }
        }

        if (this.damageFlash > 0) {
            this.damageFlash--;
        }
    }

    jump() {
        if (!this.isJumping) {
            this.velocityY = -CONFIG.player.jumpPower;
            this.isJumping = true;
            this.canDoubleJump = true;
            playSound('jump');
        } else if (this.canDoubleJump && !this.isSliding) {
            this.velocityY = -CONFIG.player.jumpPower * 0.85;
            this.canDoubleJump = false;
            playSound('jump');
        }
    }

    slide() {
        if (!this.isJumping && !this.isSliding) {
            this.isSliding = true;
            this.slideDuration = 20;
            playSound('slide');
        }
    }

    draw() {
        // Shield effect
        if (this.shieldActive) {
            ctx.strokeStyle = `rgba(0, 255, 136, 0.6)`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Magnet effect
        if (this.magnetActive) {
            ctx.fillStyle = `rgba(255, 183, 0, 0.3)`;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.magneticRange, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 183, 0, 0.5)`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Main player body
        const playerHeight = this.isSliding ? this.height * 0.5 : this.height;
        const playerY = this.isSliding ? this.y + this.height * 0.5 : this.y;

        ctx.fillStyle = this.damageFlash % 2 === 0 ? CONFIG.colors.player : 'rgba(255, 50, 50, 0.8)';
        ctx.shadowColor = CONFIG.colors.playerGlow;
        ctx.shadowBlur = 15;

        // Head
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, playerY + 10, 8, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillRect(this.x + 5, playerY + 18, this.width - 10, playerHeight - 18);

        ctx.shadowBlur = 0;
    }
}

class Obstacle {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.velocityX = -gameState.gameSpeed;
        this.color = '#ff1744';
        this.glowIntensity = 0;
        this.floatingOffset = 0;
        this.floatingSpeed = Math.random() * 0.05 + 0.05;

        switch (type) {
            case 'bug':
                this.width = 30;
                this.height = 30;
                this.color = '#ff1744';
                this.y = CONFIG.player.groundY - 5;
                break;
            case 'errorBlock':
                this.width = 40;
                this.height = 40;
                this.color = '#ff3d00';
                this.y = CONFIG.player.groundY - 40;
                break;
            case 'firewall':
                this.width = 25;
                this.height = 80;
                this.color = '#ffb300';
                this.y = CONFIG.player.groundY - 80;
                break;
            case 'virus':
                this.width = 35;
                this.height = 35;
                this.color = '#ff00ff';
                this.y = Math.random() * 200 + 100;
                this.floatingSpeed = Math.random() * 0.02 + 0.02;
                break;
            case 'crashBlock':
                this.width = 50;
                this.height = 20;
                this.color = '#ff5722';
                this.y = CONFIG.player.groundY - 20;
                break;
        }
    }

    update() {
        this.x += this.velocityX;
        this.glowIntensity = (Math.sin(frameCount * 0.05) + 1) / 2;
        this.floatingOffset += this.floatingSpeed;
        if (this.type === 'virus') {
            this.y += Math.sin(this.floatingOffset) * 0.5;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10 + this.glowIntensity * 10;

        switch (this.type) {
            case 'bug':
                // Draw bug
                ctx.beginPath();
                ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
                ctx.fill();
                // Legs
                ctx.fillRect(this.x + 2, this.y + this.height / 2, 4, 8);
                ctx.fillRect(this.x + this.width - 6, this.y + this.height / 2, 4, 8);
                break;
            case 'errorBlock':
                ctx.fillRect(this.x, this.y, this.width, this.height);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('ERR', this.x + this.width / 2, this.y + this.height / 2 + 4);
                break;
            case 'firewall':
                ctx.fillRect(this.x, this.y, this.width, this.height);
                // Laser lines
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 1;
                for (let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y + i * 20);
                    ctx.lineTo(this.x + this.width, this.y + i * 20);
                    ctx.stroke();
                }
                break;
            case 'virus':
                ctx.beginPath();
                ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
                ctx.fill();
                // Spikes
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const nextAngle = ((i + 1) / 8) * Math.PI * 2;
                    ctx.moveTo(
                        this.x + this.width / 2 + Math.cos(angle) * this.width / 2,
                        this.y + this.height / 2 + Math.sin(angle) * this.height / 2
                    );
                    ctx.lineTo(
                        this.x + this.width / 2 + Math.cos(nextAngle) * this.width / 2,
                        this.y + this.height / 2 + Math.sin(nextAngle) * this.height / 2
                    );
                }
                ctx.stroke();
                break;
            case 'crashBlock':
                ctx.fillRect(this.x, this.y, this.width, this.height);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.font = '8px monospace';
                ctx.fillText('CRASH', this.x + 5, this.y + this.height / 2 + 3);
                break;
        }

        ctx.shadowBlur = 0;
    }

    getCollisionBox() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
        };
    }
}

class Collectible {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'html', 'css', 'js', 'react', 'node', 'github', 'vscode', 'database'
        this.width = 20;
        this.height = 20;
        this.rotation = 0;
        this.floatOffset = 0;
        this.floatSpeed = 0.05;
        this.collected = false;

        const colors = {
            html: '#ff6b35',
            css: '#0066ff',
            js: '#f7df1e',
            react: '#61dafb',
            node: '#68a063',
            github: '#ffffff',
            vscode: '#007acc',
            database: '#13c2c2',
        };

        this.color = colors[type] || '#00ff88';
    }

    update() {
        this.rotation += 0.05;
        this.floatOffset += this.floatSpeed;
        this.y += Math.sin(this.floatOffset) * 0.3;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);

        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
        ctx.fill();

        // Inner glow
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, this.width / 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        ctx.shadowBlur = 0;
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'shield', 'magnet', 'slowMotion', 'scoreMultiplier'
        this.width = 25;
        this.height = 25;
        this.rotation = 0;
        this.pulseScale = 1;
        this.pulseSpeed = 0.03;

        const colors = {
            shield: '#00ff88',
            magnet: '#ffb300',
            slowMotion: '#8899ff',
            scoreMultiplier: '#ff1744',
        };

        this.color = colors[type] || '#00d4ff';
    }

    update() {
        this.rotation += 0.08;
        this.pulseScale = 1 + Math.sin(frameCount * this.pulseSpeed) * 0.2;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);
        ctx.scale(this.pulseScale, this.pulseScale);

        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;

        // Star shape
        const spikes = 5;
        const outerRadius = this.width / 2;
        const innerRadius = this.width / 4;

        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / spikes - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
        ctx.shadowBlur = 0;
    }
}

class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = 3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2;
        this.life--;
    }

    draw() {
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = this.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ===========================
// GAME ARRAYS & MANAGERS
// ===========================

let player = new Player();
let obstacles = [];
let collectibles = [];
let powerUps = [];
let particles = [];
let frameCount = 0;

class SpawnManager {
    constructor() {
        this.spawnCounter = 0;
    }

    update() {
        const difficulty = CONFIG.difficulty[gameState.difficulty];
        const spawnRate = difficulty.spawnRate;

        this.spawnCounter += spawnRate;

        if (this.spawnCounter >= 1) {
            this.spawnCounter = 0;

            // Spawn obstacle
            if (Math.random() < 0.7) {
                const types = ['bug'];
                if (gameState.level >= 2) types.push('errorBlock');
                if (gameState.level >= 3) types.push('firewall');
                if (gameState.level >= 4) types.push('virus');
                if (gameState.level >= 5) types.push('crashBlock');

                const type = types[Math.floor(Math.random() * types.length)];
                obstacles.push(new Obstacle(type, CONFIG.canvas.width, 0));
            }

            // Spawn collectible
            if (Math.random() < 0.4) {
                const types = ['html', 'css', 'js', 'react', 'node', 'github', 'vscode', 'database'];
                const type = types[Math.floor(Math.random() * types.length)];
                const y = Math.random() * 300 + 100;
                collectibles.push(new Collectible(CONFIG.canvas.width, y, type));
            }

            // Spawn power-up
            if (Math.random() < 0.08) {
                const types = ['shield', 'magnet', 'slowMotion', 'scoreMultiplier'];
                const type = types[Math.floor(Math.random() * types.length)];
                const y = Math.random() * 200 + 150;
                powerUps.push(new PowerUp(CONFIG.canvas.width, y, type));
            }
        }
    }
}

const spawnManager = new SpawnManager();

// ===========================
// COLLISION DETECTION
// ===========================

function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

function getPlayerCollisionBox() {
    let box = {
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.isSliding ? player.height * 0.5 : player.height,
    };
    if (player.isSliding) {
        box.y += player.height * 0.5;
    }
    return box;
}

// ===========================
// AUDIO SYSTEM
// ===========================

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (!gameState.soundEnabled) return;

    try {
        const now = audioContext.currentTime;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        switch (type) {
            case 'jump':
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'collect':
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
                break;
            case 'damage':
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            case 'powerUp':
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(900, now + 0.1);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'powerUpEnd':
                osc.frequency.setValueAtTime(1000, now);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'levelUp':
                for (let i = 0; i < 3; i++) {
                    const osc2 = audioContext.createOscillator();
                    const gain2 = audioContext.createGain();
                    osc2.connect(gain2);
                    gain2.connect(audioContext.destination);
                    osc2.frequency.setValueAtTime(500 + i * 200, now + i * 0.05);
                    gain2.gain.setValueAtTime(0.1, now + i * 0.05);
                    gain2.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.1);
                    osc2.start(now + i * 0.05);
                    osc2.stop(now + i * 0.05 + 0.1);
                }
                break;
            case 'gameOver':
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
        }
    } catch (e) {
        // Audio context errors - fail silently
    }
}

// ===========================
// PARTICLE SYSTEM
// ===========================

function createBurst(x, y, color, count = 8) {
    if (!gameState.particlesEnabled) return;

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 3 + Math.random() * 2;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        particles.push(new Particle(x, y, vx, vy, color, 30));
    }
}

// ===========================
// GAME LOGIC
// ===========================

function startGame() {
    gameState.currentScreen = 'playing';
    gameState.score = 0;
    gameState.distance = 0;
    gameState.level = 1;
    gameState.lives = CONFIG.difficulty[gameState.difficulty].lives;
    gameState.gameSpeed = 5;
    gameState.tokensCollected = 0;
    gameState.activePowerUp = null;

    player = new Player();
    obstacles = [];
    collectibles = [];
    powerUps = [];
    particles = [];
    frameCount = 0;

    document.getElementById('gameHUD').classList.add('active');
    document.getElementById('pauseBtn').style.display = 'block';
    updateHUD();

    // Mission mode setup
    if (gameState.gameMode === 'mission') {
        const missions = [
            { type: 'collectTokens', target: 10, label: 'Collect 10 Tokens' },
            { type: 'survive', target: 300, label: 'Survive 5 Minutes' },
            { type: 'avoidBugs', target: 5, label: 'Avoid 5 Bugs' },
            { type: 'score', target: 1000, label: 'Reach 1000 Points' },
        ];
        gameState.missionProgress = {
            type: missions[Math.floor(Math.random() * missions.length)].type,
            target: missions[Math.floor(Math.random() * missions.length)].target,
            current: 0,
        };
    }
}

function updateGame() {
    if (gameState.isPaused) return;

    frameCount++;

    // Update player
    player.update();

    // Update obstacles
    obstacles = obstacles.filter(obs => obs.x > -obs.width);
    obstacles.forEach(obs => {
        obs.velocityX = -gameState.gameSpeed * (gameState.slowMotionActive ? 0.5 : 1);
        obs.update();
    });

    // Update collectibles
    collectibles = collectibles.filter(col => col.x > -col.width && !col.collected);
    collectibles.forEach(col => col.update());

    // Update power-ups
    powerUps = powerUps.filter(pu => pu.x > -pu.width);
    powerUps.forEach(pu => pu.update());

    // Update particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => p.update());

    // Magnet effect - pull collectibles
    if (player.magnetActive) {
        collectibles.forEach(col => {
            const dx = col.x - player.x;
            const dy = col.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < player.magneticRange) {
                const angle = Math.atan2(dy, dx);
                col.x -= Math.cos(angle) * 5;
                col.y -= Math.sin(angle) * 5;
            }
        });
    }

    // Collision detection - obstacles
    obstacles.forEach(obs => {
        const playerBox = getPlayerCollisionBox();
        if (checkCollision(playerBox, obs.getCollisionBox())) {
            if (player.shieldActive) {
                player.shieldActive = false;
                obstacles = obstacles.filter(o => o !== obs);
                createBurst(obs.x + obs.width / 2, obs.y + obs.height / 2, 'rgba(0, 255, 136, 0.8)', 10);
                playSound('powerUp');
            } else {
                takeDamage();
                obstacles = obstacles.filter(o => o !== obs);
            }
        }
    });

    // Collision detection - collectibles
    collectibles.forEach(col => {
        if (checkCollision(getPlayerCollisionBox(), { x: col.x, y: col.y, width: col.width, height: col.height })) {
            col.collected = true;
            addScore(10 * player.scoreMultiplier);
            gameState.tokensCollected++;
            createBurst(col.x, col.y, col.color, 6);
            playSound('collect');

            if (gameState.gameMode === 'mission' && gameState.missionProgress.type === 'collectTokens') {
                gameState.missionProgress.current++;
            }
        }
    });

    // Collision detection - power-ups
    powerUps.forEach(pu => {
        if (checkCollision(getPlayerCollisionBox(), { x: pu.x, y: pu.y, width: pu.width, height: pu.height })) {
            activatePowerUp(pu.type);
            powerUps = powerUps.filter(p => p !== pu);
            createBurst(pu.x, pu.y, pu.color, 12);
            playSound('powerUp');
        }
    });

    // Spawn management
    spawnManager.update();

    // Increase distance
    gameState.distance += gameState.gameSpeed;

    // Level up system
    const targetDistance = gameState.level * 2000;
    if (gameState.distance >= targetDistance && gameState.level < 5) {
        levelUp();
    }

    // Game over check
    if (gameState.lives <= 0) {
        endGame();
    }

    // Screen shake
    if (gameState.screenShaking > 0) {
        gameState.screenShaking--;
    }

    updateHUD();
}

function addScore(points) {
    gameState.score += points;
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        localStorage.setItem('codeRunnerHighScore', gameState.highScore);
    }

    // Floating text
    const floatingDiv = document.createElement('div');
    floatingDiv.className = 'floating-text points';
    floatingDiv.textContent = '+' + Math.floor(points);
    floatingDiv.style.left = player.x + 'px';
    floatingDiv.style.top = player.y + 'px';
    document.getElementById('floatingTextContainer').appendChild(floatingDiv);
    setTimeout(() => floatingDiv.remove(), 1000);
}

function takeDamage() {
    gameState.lives--;
    player.damageFlash = 10;
    gameState.screenShaking = 10;
    playSound('damage');

    // Red flash
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

    if (gameState.gameMode === 'mission' && gameState.missionProgress.type === 'avoidBugs') {
        gameState.missionProgress.current++;
    }
}

function activatePowerUp(type) {
    switch (type) {
        case 'shield':
            player.shieldActive = true;
            player.shieldTime = 300;
            gameState.activePowerUp = 'SHIELD';
            gameState.powerUpTimer = 300;
            break;
        case 'magnet':
            player.magnetActive = true;
            player.magnetTime = 300;
            gameState.activePowerUp = 'MAGNET';
            gameState.powerUpTimer = 300;
            break;
        case 'slowMotion':
            player.slowMotionActive = true;
            player.slowMotionTime = 300;
            gameState.activePowerUp = 'SLOW MO';
            gameState.powerUpTimer = 300;
            break;
        case 'scoreMultiplier':
            player.scoreMultiplier = 2;
            player.scoreMultiplierTime = 300;
            gameState.activePowerUp = '2x SCORE';
            gameState.powerUpTimer = 300;
            break;
    }
}

function levelUp() {
    gameState.level++;
    gameState.gameSpeed += 0.5;

    // Increase obstacle difficulty
    if (gameState.level > 1) {
        spawnManager.spawnCounter = 0;
    }

    playSound('levelUp');

    // Show level up banner
    const banner = document.getElementById('levelUpBanner');
    document.getElementById('levelUpText').textContent = 'LEVEL ' + gameState.level + '!';
    banner.style.opacity = '1';
    setTimeout(() => {
        banner.style.opacity = '0';
    }, 1000);
}

function endGame() {
    gameState.currentScreen = 'gameOver';
    document.getElementById('gameHUD').classList.remove('active');
    document.getElementById('pauseBtn').style.display = 'none';

    // Calculate rank
    let rank = 'Beginner Coder';
    if (gameState.score >= 5000) rank = 'Code Legend';
    else if (gameState.score >= 3000) rank = 'Full Stack Warrior';
    else if (gameState.score >= 1500) rank = 'Frontend Ninja';
    else if (gameState.score >= 500) rank = 'Junior Debugger';

    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('finalDistance').textContent = Math.floor(gameState.distance / 100);
    document.getElementById('tokensCollected').textContent = gameState.tokensCollected;
    document.getElementById('finalHighScore').textContent = gameState.highScore;
    document.getElementById('rankTitle').textContent = rank;

    playSound('gameOver');
}

// ===========================
// RENDERING
// ===========================

function drawBackground() {
    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.height);
    gradient.addColorStop(0, 'rgba(10, 14, 39, 1)');
    gradient.addColorStop(1, 'rgba(30, 40, 70, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

    // Parallax code rain
    ctx.fillStyle = 'rgba(0, 212, 255, 0.03)';
    ctx.font = '10px monospace';
    for (let i = 0; i < 10; i++) {
        const x = (frameCount * 0.5 + i * 120) % CONFIG.canvas.width;
        ctx.fillText('<CODE>', x, 100 + i * 60);
        ctx.fillText('}/>', x + 100, 130 + i * 60);
    }

    // Grid floor
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    const offset = (frameCount * gameState.gameSpeed * 0.5) % gridSize;

    for (let x = -gridSize + offset; x < CONFIG.canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, CONFIG.player.groundY);
        ctx.lineTo(x + gridSize, CONFIG.player.groundY);
        ctx.stroke();
    }

    // Ground line
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, CONFIG.player.groundY);
    ctx.lineTo(CONFIG.canvas.width, CONFIG.player.groundY);
    ctx.stroke();

    // Horizon effects
    ctx.fillStyle = 'rgba(0, 212, 255, 0.05)';
    ctx.fillRect(0, CONFIG.player.groundY - 100, CONFIG.canvas.width, 100);

    // Floating particles background
    ctx.fillStyle = 'rgba(0, 212, 255, 0.1)';
    for (let i = 0; i < 20; i++) {
        const x = (frameCount * 0.1 + i * 60) % CONFIG.canvas.width;
        const y = 100 + (i * 7) % 200;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawGame() {
    // Apply screen shake
    if (gameState.screenShaking > 0) {
        ctx.translate(
            (Math.random() - 0.5) * gameState.screenShaking,
            (Math.random() - 0.5) * gameState.screenShaking
        );
    }

    drawBackground();

    // Draw game objects
    obstacles.forEach(obs => obs.draw());
    collectibles.forEach(col => col.draw());
    powerUps.forEach(pu => pu.draw());
    particles.forEach(p => p.draw());
    player.draw();

    // Slow motion visual effect
    if (player.slowMotionActive) {
        ctx.fillStyle = 'rgba(136, 153, 255, 0.1)';
        ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
    }

    ctx.resetTransform();
}

// ===========================
// HUD UPDATE
// ===========================

function updateHUD() {
    document.getElementById('scoreDisplay').textContent = gameState.score;
    document.getElementById('levelDisplay').textContent = gameState.level;
    document.getElementById('distanceDisplay').textContent = Math.floor(gameState.distance / 100);

    // Lives
    const livesDisplay = document.getElementById('livesDisplay');
    livesDisplay.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const life = document.createElement('span');
        life.className = 'life-icon';
        if (i >= gameState.lives) life.classList.add('lost');
        life.textContent = '❤';
        livesDisplay.appendChild(life);
    }

    // Power-up indicator
    const indicator = document.getElementById('powerUpIndicator');
    if (gameState.activePowerUp) {
        indicator.style.display = 'flex';
        document.getElementById('powerUpName').textContent = gameState.activePowerUp;
        const timer = document.getElementById('powerUpTimer');
        const percent = (gameState.powerUpTimer / 300) * 100;
        timer.style.width = percent + '%';
    } else {
        indicator.style.display = 'none';
    }
}

// ===========================
// SCREEN MANAGEMENT
// ===========================

function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenName + 'Screen').classList.add('active');
    gameState.currentScreen = screenName;
}

function showLoadingScreen() {
    showScreen('loading');
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(() => showScreen('menu'), 500);
        }
        document.getElementById('progressBar').style.width = progress + '%';
    }, 200);
}

// ===========================
// EVENT LISTENERS
// ===========================

// Keyboard
document.addEventListener('keydown', (e) => {
    if (gameState.currentScreen === 'playing') {
        if (e.key === ' ' || e.key === 'ArrowUp') {
            e.preventDefault();
            player.jump();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            player.slide();
        } else if (e.key === 'p' || e.key === 'P') {
            togglePause();
        } else if (e.key === 'r' || e.key === 'R') {
            startGame();
        }
    }
});

// Mouse / Touch
let lastTapTime = 0;
let tapCount = 0;

canvas.addEventListener('click', (e) => {
    if (gameState.currentScreen === 'playing') {
        const now = Date.now();
        if (now - lastTapTime < 300) {
            tapCount++;
        } else {
            tapCount = 1;
        }
        lastTapTime = now;

        if (tapCount === 1) {
            player.jump();
        }
    }
});

// Touch events
canvas.addEventListener('touchstart', (e) => {
    if (gameState.currentScreen === 'playing') {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const y = touch.clientY - rect.top;

        // Swipe down detection
        if (y > CONFIG.canvas.height * 0.5) {
            player.slide();
        } else {
            player.jump();
        }
    }
}, false);

// Button listeners
document.getElementById('startBtn').addEventListener('click', () => {
    gameState.gameMode = 'endless';
    startGame();
});

document.getElementById('modeSelectBtn').addEventListener('click', () => showScreen('modeSelect'));
document.getElementById('endlessMode').addEventListener('click', () => {
    gameState.gameMode = 'endless';
    startGame();
});
document.getElementById('missionMode').addEventListener('click', () => {
    gameState.gameMode = 'mission';
    startGame();
});

document.getElementById('howToPlayBtn').addEventListener('click', () => showScreen('howToPlay'));
document.getElementById('settingsBtn').addEventListener('click', () => showScreen('settings'));

document.getElementById('backFromModeBtn').addEventListener('click', () => showScreen('menu'));
document.getElementById('backFromHowBtn').addEventListener('click', () => showScreen('menu'));
document.getElementById('backFromSettingsBtn').addEventListener('click', () => showScreen('menu'));

document.getElementById('pauseBtn').addEventListener('click', togglePause);
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('restartFromPauseBtn').addEventListener('click', startGame);
document.getElementById('menuFromPauseBtn').addEventListener('click', () => {
    gameState.isPaused = false;
    showScreen('menu');
    document.getElementById('gameHUD').classList.remove('active');
    document.getElementById('pauseBtn').style.display = 'none';
});

document.getElementById('playAgainBtn').addEventListener('click', startGame);
document.getElementById('menuBtn').addEventListener('click', () => showScreen('menu'));
document.getElementById('shareBtn').addEventListener('click', () => {
    const text = `I scored ${gameState.score} points in Code Runner: Neon Debug Quest! 🎮 Try the game: [your-link-here]`;
    if (navigator.share) {
        navigator.share({ title: 'Code Runner', text: text });
    } else {
        alert(text);
    }
});

// Settings
document.getElementById('soundToggle').addEventListener('change', (e) => {
    gameState.soundEnabled = e.target.checked;
    localStorage.setItem('codeRunnerSound', gameState.soundEnabled);
});

document.getElementById('particlesToggle').addEventListener('change', (e) => {
    gameState.particlesEnabled = e.target.checked;
    localStorage.setItem('codeRunnerParticles', gameState.particlesEnabled);
});

document.getElementById('difficultySelect').addEventListener('change', (e) => {
    gameState.difficulty = e.target.value;
    localStorage.setItem('codeRunnerDifficulty', gameState.difficulty);
});

document.querySelectorAll('.theme-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        const theme = option.dataset.theme;
        gameState.theme = theme;
        localStorage.setItem('codeRunnerTheme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    });
});

// Load theme
document.documentElement.setAttribute('data-theme', gameState.theme);

// Difficulty setting
document.getElementById('difficultySelect').value = gameState.difficulty;

// High score display
function updateMenuHighScore() {
    document.getElementById('menuHighScore').textContent = gameState.highScore;
}

function togglePause() {
    gameState.isPaused = !gameState.isPaused;
    if (gameState.isPaused) {
        showScreen('pause');
    } else {
        showScreen('playing');
    }
}

// Note: showScreen temporarily changes the overlay, but we keep playing canvas
Object.defineProperty(gameState, 'currentScreen', {
    set: function(value) {
        this._currentScreen = value;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if (value === 'playing') {
            document.getElementById('gameHUD').classList.add('active');
        } else if (value === 'paused') {
            document.getElementById('pauseScreen').classList.add('active');
            document.getElementById('gameHUD').classList.add('active');
        } else if (value === 'gameOver') {
            document.getElementById('gameOverScreen').classList.add('active');
            document.getElementById('gameHUD').classList.remove('active');
        } else {
            document.getElementById(value + 'Screen').classList.add('active');
        }
    },
    get: function() {
        return this._currentScreen;
    },
});

// ===========================
// GAME LOOP
// ===========================

function gameLoop() {
    updateGame();
    drawGame();
    requestAnimationFrame(gameLoop);
}

// Landing screen CTA -> kicks off the existing loading sequence
document.getElementById('playGameCtaBtn').addEventListener('click', () => {
    showLoadingScreen();
});

// Initialize
updateMenuHighScore();
gameLoop();
