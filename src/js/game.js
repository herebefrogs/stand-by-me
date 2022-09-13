import { anyKeyDown, isKeyDown, isKeyUp, whichKeyDown } from './inputs/keyboard';
import { isPointerDown, isPointerUp, pointerCanvasPosition } from './inputs/pointer';
import { isMobile } from './mobile';
import { checkMonetization, isMonetizationEnabled } from './monetization';
import { share } from './share';
import { loadSongs, playSong, stopSong } from './sound';
import { initSpeech } from './speech';
import { save, load } from './storage';
import { ALIGN_LEFT, ALIGN_CENTER, ALIGN_RIGHT, CHARSET_SIZE, initCharset, renderText, initTextBuffer, clearTextBuffer, renderAnimatedText } from './text';
import { getRandSeed, setRandSeed, lerp, loadImg, rand } from './utils';
import TILESET from '../img/tileset.webp';
import FLIPPED_TILESET from '../img/flippedtileset.webp';



const konamiCode = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
let konamiIndex = 0;

// GAMEPLAY VARIABLES

const TITLE_SCREEN = 0;
const INTRO_SCREEN = 1;
const GAME_SCREEN = 2;
const END_SCREEN = 3;
let screen = TITLE_SCREEN;

// factor by which to reduce both velX and velY when player moving diagonally
// so they don't seem to move faster than when traveling vertically or horizontally
const RADIUS_ONE_AT_45_DEG = Math.cos(Math.PI / 4);
const TIME_TO_FULL_SPEED = 150;                // in millis, duration till going full speed in any direction

let hero;
let ai;
let crosshair;  // coordinate in viewport space (add viewportOffset to convert to map space)
let blast;
let entities;
let invincibleMode;

let speak;

const FOE_TYPES = ['scout', 'tank'];
const INVINCIBLE_DURATION = 150; // in millisecond, time during which a hit entity is immune to further damage

// RENDER VARIABLES

let cameraX = 0;                        // camera/viewport position in map
let cameraY = 0;
const CAMERA_WIDTH = 240;               // camera/viewport size
const CAMERA_HEIGHT = 180;
// camera-window & edge-snapping settings
const CAMERA_WINDOW_X = 96;
const CAMERA_WINDOW_Y = 64;
const CAMERA_WINDOW_WIDTH = CAMERA_WIDTH - 2*CAMERA_WINDOW_X;
const CAMERA_WINDOW_HEIGHT = CAMERA_HEIGHT - 2*CAMERA_WINDOW_Y;


const CTX = c.getContext('2d');         // visible canvas
const BUFFER = c.cloneNode();           // backbuffer
const BUFFER_CTX = BUFFER.getContext('2d');
BUFFER.width = 640;                     // backbuffer size
BUFFER.height = 480;
const MAP = c.cloneNode();              // static elements of the map/world cached once
const MAP_CTX = MAP.getContext('2d');
MAP.width = 640;                        // map size, same as backbuffer
MAP.height = 480;
const [TEXT, TEXT_CTX] = initTextBuffer(c, CAMERA_WIDTH, CAMERA_HEIGHT);  // text buffer

const COLOR_LIGHT_BEIGE = '#e6d6c2';
const COLOR_DARK_BLUE = '#1c467a';
const COLOR_LIGHT_BLUE = '#87b6b5';
const COLOR_OFF_PALETTE_BLUE = '#1ee';
const COLOR_OFF_PALETTE_PURPLE = '#e1e';


const ATLAS = {
  hero: {
    attackRate: 0.1,  // 10 shots per second
    hitPoints: 100,
    speed: 75,        // px/s
    w: 16,
    h: 16,
    idle: { x: 0, y: 48, w: 16, h: 16 },
    torso_forward: { x: 16, y: 48, w: 16, h: 9 },
    torso_backward: { x: 32, y: 48, w: 16, h: 9},
    frameIndex1: 0,  // legs
    frameIndex1Time: 0,
    legs: [
      { x: 16, y: 57, w: 16, h: 7 },
      { x: 32, y: 57, w: 16, h: 7 },
      { x: 48, y: 57, w: 16, h: 7 },
      { x: 64, y: 57, w: 16, h: 7 },
    ],
    gun: { x: 48, y: 48, w: 11, h: 7 },
    frameIndex2: 0,  // muzzle flash
    frameIndex2Time: 0,
    muzzle_flash: [
      { x: 64, y: 48, w: 6, h: 8 },
      { x: 71, y: 48, w: 5, h: 8 },
      { x: 77, y: 48, w: 3, h: 8 },
    ],
  },
  AI: {
    angle: 0,
    hitPoints: 10,
    speed: Math.PI,   // radians/s (half a circle/s)
    w: 8,
    h: 8,
    sprite: { x: 96, y: 112, w: 8, h: 8 },
    health: [
      { x: 112, y: 96, w: 16, h: 16 },
      { x: 96,  y: 96, w: 16, h: 16 },
      { x: 80,  y: 96, w: 16, h: 16 },
      { x: 112, y: 80, w: 16, h: 16 },
      { x: 96,  y: 80, w: 16, h: 16 },
      { x: 80,  y: 80, w: 16, h: 16 },
      { x: 112, y: 64, w: 16, h: 16 },
      { x: 96,  y: 64, w: 16, h: 16 },
      { x: 80,  y: 64, w: 16, h: 16 },
      { x: 80,  y: 112, w: 16, h: 16 },
      { x: 112,  y: 112, w: 16, h: 16 },
    ]
  },
  bullet: {
    damage: 1,
    speed: 400,
    ttl: Infinity,
    w: 1,
    h: 10
  },
  blast: {
    speed: 400,
    maxRadius: 200,
    w: 20,
  },
  scout: {
    damage: 2,
    hitPoints: 1,
    speed: 110,
    w: 16,
    h: 10,
    hit: { x: 128, y: 38, w: 16, h: 10 },
    blood: { x: 32, y: 112, w: 16, h: 10 },
    frameIndex1: 0,
    frameIndex1Time: 0,
    bite: [
      { x: 0, y: 38, w: 16, h: 10 },
      { x: 16, y: 38, w: 16, h: 10 },
    ],
    frameIndex2: 0,
    frameIndex2Time: 0,
    walk: [
      { x: 32, y: 38, w: 16, h: 10 },
      { x: 48, y: 38, w: 16, h: 10 },
      { x: 64, y: 38, w: 16, h: 10 },
    ]
  },
  tank: {
    damage: 10,
    hitPoints: 10,
    speed: 45,
    w: 32,
    h: 32,
    hit: { x: 128, y: 0, w: 32, h: 32 },
    blood: { x: 48, y: 96, w: 32, h: 32 },
    frameIndex1: 0,
    frameIndex1Time: 0,
    bite: [
      { x: 0, y: 0, w: 32, h: 32 },
      { x: 32, y: 0, w: 32, h: 32 },
    ],
    frameIndex2: 0,
    frameIndex2Time: 0,
    walk: [
      { x: 64, y: 0, w: 32, h: 32 },
      { x: 96, y: 0, w: 32, h: 32 },
      { x: 96, y: 32, w: 32, h: 32 },
    ],
  },
  ingresses: [
    {
      name: 'nw',
      x: 32,
      y: 48,
      odds: {
        tank: 0, // %
        scout: 1 // %
      },
      rate: 1000, // foe per second
      spawnTime: 0,
      openTime: 5000,
      closeTime: 35000,
    },
    {
      name: 's',
      x: 272,
      y: 432,
      odds: {
        tank: 0, // %
        scout: 1 // %
      },
      rate: 750, // foe per second
      spawnTime: 0,
      openTime: 35000,
      closeTime: 65000,
    },
  ],
  tiles: {
    // walls
    0: { x: 0, y: 112 },
    1: { x: 0, y: 64 },
    2: { x: 16, y: 64 },
    3: { x: 32, y: 64 },
    4: { x: 0, y: 80 },
    5: { x: 16, y: 80 },
    6: { x: 32, y: 80 },
    7: { x: 0, y: 96 },
    8: { x: 16, y: 96 },
    9: { x: 32, y: 96 },
    0xb: { x: 128, y: 96 },
    0xc: { x: 144, y: 96 },
    0xd: { x: 128, y: 112 },
    0xe: { x: 144, y: 112 },
    // central core
    0xa: { x: 48, y: 69 },
    // ingress (closed)
    0xf: { x: 80, y: 48 }
  }
};

const level =
"5555555555555555555555555555555555555555\
B8888888888888888888888888888CB88888888C\
6000000000000000000000000000046000000004\
60F00000000000000000000F00000460000F0004\
6000000000000130000000000000079000000004\
6000000000000460000000000000000000000004\
D222230000000790000000000000000000000004\
B888890000000000000000000000000012223004\
6000000000000000000000000000000078889004\
6000000000012222300000012222300000000004\
600000000004555560000004555560000000F004\
600000000004B88890000007888C600000000004\
6000000000079000000000000004600000000004\
6000000000000000000000000007900000000004\
6000000000000000000A00000000000000000004\
6000013000000000000000000000000000000004\
60F0079000013000000000000000000000000004\
6000000000046000000000000001300000000004\
600000000004D22230000001222E600000000004\
6000000000078888900000078888900000000004\
6000000000000000000000000000000000000004\
6000000000000000000000000000000000000004\
600000000000000000000013000000001222222E\
600122222300000000000046000000007888888C\
6007888889000000000000790000000000000004\
6000000000000000000000000000000000000004\
6000000000000130000000000000000000000004\
600F0000000004600F0000000000000000000F04\
6000000000000460000000000000000000000004\
D222222222222ED222222222222222222222222E";

let walls;

const AI_HEALTH_CHAT = {
  9: 's.h.e.i.l.d. protocol activated!',
  8: 'hey, that was weird...',
  7: 'did you feel that too?',
  6: 'outch, that really hurt!',
  5: 'what\s... what\'s happening to me?',
  4: 'i\'m scared!',
  3: 'i don\'t feel so good...',
  2: 'am i going to die?',
  1: 'please, don\'t leave me!',
  0: '[segfault] access violation',
}

const FRAME_DURATION = 0.1; // duration of 1 animation frame, in seconds
let tileset;   // characters sprite, embedded as a base64 encoded dataurl by build script
let flipped_tileset; // characters sprite facing left

// LOOP VARIABLES

let currentTime;
let elapsedTime;
let lastTime;
let requestId;
let running = true;
let stopTime;

const STOP_TIME_HERO_HIT = 75; // in ms

// GAMEPLAY HANDLERS

function unlockExtraContent() {
  // NOTE: remember to update the value of the monetization meta tag in src/index.html to your payment pointer
}

function setScreen(newScreen) {
  // consume all key/pointer down so they don't trigger an action on the new screen
  isPointerUp();
  whichKeyDown().forEach(isKeyUp);

  screen = newScreen;
}

function startGame() {
  setRandSeed('js13k2022');
  // if (isMonetizationEnabled()) { unlockExtraContent() }
  konamiIndex = 0;
  cameraX = 160
  cameraY = 116;
  hero = createEntity('hero', 256, 208);
  ai = { type: 'AI', ...ATLAS['AI'] }
  // TODO have a toggle on title screen that only Coil members can switch
  invincibleMode = true;
  crosshair = { x: 0, y: 0 };
  blast = 0;
  entities = [
    ...ATLAS.ingresses.map(createIngress),
    hero,
    ai,
  ];
  stopTime = 0;
  walls = loadMap();
  playSong();
  setScreen(GAME_SCREEN);
};

function testAABBCollision(entity1, entity2) {
  const test = {
    left: entity1.x - (entity2.x + entity2.w),
    right: entity1.x + entity1.w - entity2.x,
    top: entity1.y - (entity2.y + entity2.h),
    bottom: entity1.y + entity1.h - entity2.y,
    entity1MaxX: entity1.x + entity1.w,
    entity1MaxY: entity1.y + entity1.h,
    entity2MaxX: entity2.x + entity2.w,
    entity2MaxY: entity2.y + entity2.h,
  };

  test.collide = test.left < 0
    && test.right > 0
    && test.top < 0
    && test.bottom > 0;

  return test;
};

// entity1 collided into entity2, both can be moved
function correct2EntitiesCollision(entity1, entity2, test) {
  const { entity1MaxX, entity1MaxY, entity2MaxX, entity2MaxY } = test;

  const deltaMaxX = entity1MaxX - entity2.x;
  const deltaMaxY = entity1MaxY - entity2.y;
  const deltaMinX = entity2MaxX - entity1.x;
  const deltaMinY = entity2MaxY - entity1.y;

  // AABB collision response (homegrown wall sliding, not physically correct
  // because just pushing along one axis by the distance overlapped)

  const velSumX = Math.abs(entity1.velX) + Math.abs(entity2.velX);
  const velSumY = Math.abs(entity1.velY) + Math.abs(entity2.velY);

  // entity1 moving down/right
  if (entity1.velX > 0 && entity1.velY > 0) {
    if (deltaMaxX < deltaMaxY) {
      // collided right side first
      // TODO should be proportional to each entity's velocity
      // (e.g. the faster the less displaced)
      entity1.x -= deltaMaxX / 2;
      entity2.x += deltaMaxX / 2;
    } else {
      // collided top side first
      entity1.y -= deltaMaxY / 2;
      entity2.y += deltaMaxY / 2;
    }
  }
  // entity1 moving up/right
  else if (entity1.velX > 0 && entity1.velY < 0) {
    if (deltaMaxX < deltaMinY) {
      // collided right side first
      entity1.x -= deltaMaxX / 2;
      entity2.x += deltaMaxX / 2;
    } else {
      // collided bottom side first
      entity1.y += deltaMinY / 2;
      entity2.y -= deltaMinY / 2;
    }
  }
  // entity1 moving right
  else if (entity1.velX > 0) {
    entity1.x -= deltaMaxX / 2;
    entity2.x += deltaMaxX / 2;
  }
  // entity1 moving down/left
  else if (entity1.velX < 0 && entity1.velY > 0) {
    if (deltaMinX < deltaMaxY) {
      // collided left side first
      entity1.x += deltaMinX / 2;
      entity2.x -= deltaMinX / 2;
    } else {
      // collided top side first
      entity1.y -= deltaMaxY / 2;
      entity2.y += deltaMaxY / 2;
    }
  }
  // entity1 moving up/left
  else if (entity1.velX < 0 && entity1.velY < 0) {
    if (deltaMinX < deltaMinY) {
      // collided left side first
      entity1.x += deltaMinX / 2;
      entity2.x -= deltaMinX / 2;
    } else {
      // collided bottom side first
      entity1.y += deltaMinY / 2;
      entity2.y -= deltaMinY / 2;
    }
  }
  // entity1 moving left
  else if (entity1.velX < 0) {
    entity1.x += deltaMinX / 2;
    entity2.x -= deltaMinX / 2;
  }
  // entity1 moving down
  else if (entity1.velY > 0) {
    entity1.y -= deltaMaxY / 2;
    entity2.y += deltaMaxY / 2;
  }
  // entity1 moving up
  else if (entity1.velY < 0) {
    entity1.y += deltaMinY / 2;
    entity2.y -= deltaMinY / 2;
  }
};

// entity1 collided into entity2, entity1 will move, entity2 stay put
function correctEntityToWallCollision(entity1, entity2, test) {
  const { entity1MaxX, entity1MaxY, entity2MaxX, entity2MaxY } = test;

  const deltaMaxX = entity1MaxX - entity2.x;
  const deltaMaxY = entity1MaxY - entity2.y;
  const deltaMinX = entity2MaxX - entity1.x;
  const deltaMinY = entity2MaxY - entity1.y;

  // AABB collision response (homegrown wall sliding, not physically correct
  // because just pushing along one axis by the distance overlapped)

  // entity1 moving down/right
  if (entity1.velX > 0 && entity1.velY > 0) {
    if (deltaMaxX < deltaMaxY) {
      // collided right side first
      entity1.x -= deltaMaxX;
    } else {
      // collided top side first
      entity1.y -= deltaMaxY;
    }
  }
  // entity1 moving up/right
  else if (entity1.velX > 0 && entity1.velY < 0) {
    if (deltaMaxX < deltaMinY) {
      // collided right side first
      entity1.x -= deltaMaxX;
    } else {
      // collided bottom side first
      entity1.y += deltaMinY;
    }
  }
  // entity1 moving right
  else if (entity1.velX > 0) {
    entity1.x -= deltaMaxX;
  }
  // entity1 moving down/left
  else if (entity1.velX < 0 && entity1.velY > 0) {
    if (deltaMinX < deltaMaxY) {
      // collided left side first
      entity1.x += deltaMinX;
    } else {
      // collided top side first
      entity1.y -= deltaMaxY;
    }
  }
  // entity1 moving up/left
  else if (entity1.velX < 0 && entity1.velY < 0) {
    if (deltaMinX < deltaMinY) {
      // collided left side first
      entity1.x += deltaMinX;
    } else {
      // collided bottom side first
      entity1.y += deltaMinY;
    }
  }
  // entity1 moving left
  else if (entity1.velX < 0) {
    entity1.x += deltaMinX;
  }
  // entity1 moving down
  else if (entity1.velY > 0) {
    entity1.y -= deltaMaxY;
  }
  // entity1 moving up
  else if (entity1.velY < 0) {
    entity1.y += deltaMinY;
  }
};


function updateCameraWindow() {
  // TODO try to simplify the formulae below with this variable so it's easier to visualize
  // const cameraEdgeLeftX = cameraX + CAMERA_WINDOW_X;
  // const cameraEdgeTopY = cameraY + CAMERA_WINDOW_Y;
  // const cameraEdgeRightX = cameraEdgeLeftX + CAMERA_WINDOW_WIDTH;
  // const cameraEdgeBottomY = cameraEdgeTopY + CAMERA_WINDOW_HEIGHT;

  // edge snapping
  if (0 < cameraX && hero.x < cameraX + CAMERA_WINDOW_X) {
    cameraX = Math.max(0, hero.x - CAMERA_WINDOW_X);
  }
  else if (cameraX + CAMERA_WINDOW_X + CAMERA_WINDOW_WIDTH < MAP.width && hero.x + hero.w > cameraX + CAMERA_WINDOW_X + CAMERA_WINDOW_WIDTH) {
    cameraX = Math.min(MAP.width - CAMERA_WIDTH, hero.x + hero.w - (CAMERA_WINDOW_X + CAMERA_WINDOW_WIDTH));
  }
  if (0 < cameraY && hero.y < cameraY + CAMERA_WINDOW_Y) {
    cameraY = Math.max(0, hero.y - CAMERA_WINDOW_Y);
  }
  else if (cameraY + CAMERA_WINDOW_Y + CAMERA_WINDOW_HEIGHT < MAP.height && hero.y + hero.h > cameraY + CAMERA_WINDOW_Y + CAMERA_WINDOW_HEIGHT) {
    cameraY = Math.min(MAP.height - CAMERA_HEIGHT, hero.y + hero.h - (CAMERA_WINDOW_Y + CAMERA_WINDOW_HEIGHT));
  }
};

function velocityForTarget(srcX, srcY, destX, destY) {
  const hypotenuse = Math.sqrt(Math.pow(destX - srcX, 2) + Math.pow(destY - srcY, 2))
  const adjacent = destX - srcX;
  const opposite = destY - srcY;
  // [
  //  velX = cos(alpha),
  //  velY = sin(alpha),
  //  alpha (0 is east, -PI/2 is north, PI/2 is south, PI is west)
  // ]
  return [
    adjacent / hypotenuse,
    opposite / hypotenuse,
    Math.atan2(opposite / hypotenuse, adjacent / hypotenuse),
  ];
}

function positionOnCircle(centerX, centerY, radius, angle) {
  return [
    centerX + radius * Math.cos(angle),
    centerY + radius * Math.sin(angle)
  ];
}

const enqueueAiHealthChat = () => {
  // flush previous health text
  entities = entities.filter(e => e.type !== 'text');

  entities.push(createText(
    AI_HEALTH_CHAT[ai.hitPoints]
  ));
}

const createIngress = (ingress) => (
  {
    type: 'ingress',
    ...ingress,
    openTime: ingress.openTime + currentTime,
    closeTime: ingress.closeTime + currentTime
  }
);

const createText = (text, x, y) => ({
  startTime: currentTime,
  text,
  ttl: currentTime + 5000,
  type: 'text',
  x: 4*ai.w + CHARSET_SIZE,
  y: 2*CHARSET_SIZE
})

function createEntity(type, x = 0, y = 0) {
  return {
    ...ATLAS[type], // speed, w, h
    // frame: 0,
    // frameTime: 0,
    moveDown: 0,
    moveLeft: 0,
    moveRight: 0,
    moveUp: 0,
    velX: 0,
    velY: 0,
    type,
    x,
    y,
  };
};

const pointerMapPosition = () => {
  const [x, y] = pointerCanvasPosition(c.width, c.height);
  return [x*CAMERA_WIDTH/c.width + cameraX, y*CAMERA_HEIGHT/c.height + cameraY].map(Math.round);
}

function collectHeroInputs() {
  [crosshair.x, crosshair.y] = pointerMapPosition();
  hero.attacking = isPointerDown();

  hero.moveLeft = isKeyDown(
    'ArrowLeft',
    'KeyA',   // English Keyboard layout
    'KeyQ'    // French keyboard layout
  );
  hero.moveRight = isKeyDown(
    'ArrowRight',
    'KeyD'
  );
  hero.moveUp = isKeyDown(
    'ArrowUp',
    'KeyW',   // English Keyboard layout
    'KeyZ'    // French keyboard layout
  );
  hero.moveDown = isKeyDown(
    'ArrowDown',
    'KeyS'
  );

  if (hero.moveLeft || hero.moveRight) {
    hero.velX = (hero.moveLeft > hero.moveRight ? -1 : 1) * lerp(0, 1, (currentTime - Math.max(hero.moveLeft, hero.moveRight)) / TIME_TO_FULL_SPEED)
  } else {
    hero.velX = 0;
  }
  if (hero.moveDown || hero.moveUp) {
    hero.velY = (hero.moveUp > hero.moveDown ? -1 : 1) * lerp(0, 1, (currentTime - Math.max(hero.moveUp, hero.moveDown)) / TIME_TO_FULL_SPEED)
  } else {
    hero.velY = 0;
  }
}

function handleHeroAttack() {
  const heroCenterX = hero.x+hero.w/2;
  const heroCenterY = hero.y+hero.h/2;

  const [velX, velY, angle] = velocityForTarget(heroCenterX, heroCenterY, crosshair.x, crosshair.y);
  hero.gunAngle = angle;

  if (hero.attacking) {
    hero.attackTime ||= hero.attackRate;  // fire now if hasn't fired yet
    hero.attackTime += elapsedTime;
    if (hero.attackTime > hero.attackRate) {
      hero.attackTime %= hero.attackRate;
      const [x, y] = positionOnCircle(heroCenterX, heroCenterY, hero.w, angle)
      entities.unshift({
        ...createEntity('bullet', x, y),
        angle,
        velX,
        velY,
      })
    }
  } else {
    hero.attackTime = 0;
  }
}

const isIngressOpen = (ingress) => (ingress.openTime <= currentTime) && (currentTime <= ingress.closeTime);

function spawnEnemy(ingress) {
  if (isIngressOpen(ingress) && (ingress.spawnTime < currentTime)) {
    // guarantee an enemy is always spawned
    let cumulativeOdd = 0;

    Object.entries(ingress.odds).find(([type, odd]) => {
      cumulativeOdd += odd;

      if (rand() < cumulativeOdd) {
        entities.push(createEntity(type, ingress.x, ingress.y));
        ingress.spawnTime = currentTime + ingress.rate;
        return true;
      }
    })
  }
}

function updateEntityPosition(entity) {
  // velocity component: update position
  if (entity.velX || entity.velY) {
    const scale = entity.velX && entity.velY ? RADIUS_ONE_AT_45_DEG : 1;
    const distance = entity.speed * elapsedTime * scale;
    entity.x += distance * entity.velX;
    entity.y += distance * entity.velY;
  }
  // radial velocity component: update radius
  if (entity.maxRadius) {
    entity.radius += entity.speed * elapsedTime;
  }
  // angular velocity component: update angle
  if (entity === ai) {
    entity.angle += entity.speed * elapsedTime;
    entity.angle %= 2*Math.PI;
  }
}

function handleEnemyVelocity(entity) {
  if (entity.hitPoints > 0) {
    const entityCenterX = entity.x+entity.w/2;
    const entityCenterY = entity.y+entity.h/2;
  
    // TODO decide whether aiming for the central core or the player
    const heroCenterX = hero.x+hero.w/2;
    const heroCenterY = hero.y+hero.h/2;
  
    [entity.velX, entity.velY, _] = velocityForTarget(entityCenterX, entityCenterY, heroCenterX, heroCenterY);
  } else {
    entity.velX = entity.velY = 0;
  }
}

function handleMissileAttacks(bullets, enemies) {
  bullets.forEach(bullet => {
    if (bullet.ttl > 0) {
      // should be a forEach() but find() allows to exit early
      enemies.find(foe => {
        if (!foe.invincible && testAABBCollision(bullet, foe).collide) {
          // enemy damage
          foe.hitPoints -= bullet.damage;
          foe.invincible = true;
          foe.invincibleEndTime = currentTime + INVINCIBLE_DURATION;
          // bullet spent
          bullet.ttl = -1; // NOTE: 0 would behaves like undefined and keep the bullet
          // don't check further enemies since bullet is spent
          return true;
        };
      })
    }
  })
}

function handleBlastAttacks(enemies) {
  enemies.forEach(foe => {
    const distance = Math.sqrt(
      Math.pow((foe.x + foe.w/2 - blast.x), 2) +
      Math.pow((foe.y + foe.h/2 - blast.y), 2)
    )

    // TODO should invincible enemies be immune?
    if (distance < blast.radius) {
      foe.hitPoints = 0;
      foe.invincible ||= true;
      foe.invincibleEndTime ||= currentTime + INVINCIBLE_DURATION;  // do not reset invincible time if already invincible
    }
  })
}

function handleMeleeAttacks(enemies) {
  if (!hero.invincible) {
    enemies.find(foe => {
      // must be alive to do damage
      if (foe.hitPoints > 0 && testAABBCollision(foe, hero).collide) {
        foe.attacking = true;

        // who really takes damage?
        if (invincibleMode && ai.hitPoints > 0) {
          ai.hitPoints -= 1;
          enqueueAiHealthChat();
        } else {
          hero.hitPoints -= foe.damage;
        }
        
        // mark hero has hit
        hero.invincible = true;
        hero.invincibleEndTime = currentTime + INVINCIBLE_DURATION;

        // suspend action subliminously
        stopTime = currentTime + STOP_TIME_HERO_HIT;

        // trigger blast wave if AI still alive
        if (!blast && ai.hitPoints > 0) {
          blast = {
            type: 'blast',
            ...ATLAS['blast'],
            radius: hero.w,
            x: hero.x + hero.w/2,
            y: hero.y + hero.h/2
          }
          entities.unshift(blast);
        }

        // don't check further enemies since hero can't be hurt for a while
        return true;
      }
    })
  }
}

function handleHeroAndEnemiesCollision(colliders) {
  colliders.forEach((entity1, i) => {
    colliders.slice(i+1).forEach(entity2 => {
      const test = testAABBCollision(entity1, entity2);
      if (test.collide) {
        correct2EntitiesCollision(entity1, entity2, test);
      }
    })
  })
}

function handleWallsCollision(colliders) {
  colliders.forEach(entity => {
    walls.forEach(wall => {
      const test = testAABBCollision(entity, wall);
      if (test.collide) {
        correctEntityToWallCollision(entity, wall, test);

        if (entity.type === 'bullet') {
          // bullet is spent
          entity.ttl = -1;
        }
      }
    })
  })
}

function updateEntityTimers(entity) {
  if (entity.invincibleEndTime < currentTime) {
    entity.invincible = false;
    if (entity.hitPoints <= 0) {
      // no more hitpoints, mark for removal
      entity.ttl = -1;

      if (entity === hero) {
        hero.ded = true;
        stopTime = currentTime + 1000;
      }
      if (FOE_TYPES.includes(entity.type)) {
        renderBloodSpot(entity);
      }
    }
  }

  if (entity.radius > entity.maxRadius) {
    // blast wave is spent
    entity.ttl = -1;
    blast = 0;
  }

  if (entity === ai && ai.hitPoints <= 0) {
    entity.ttl = -1;
  }

  switch (entity.type) {
    case 'hero':
      hero.movingRight = hero.velX >= 0;
      hero.aimingRight = (-Math.PI/2 < hero.gunAngle) && (hero.gunAngle < Math.PI / 2);
      hero.movingForward = (hero.aimingRight && hero.movingRight) || (!hero.aimingRight && !hero.movingRight);
      
      entity.frameIndex1Time += elapsedTime;
      entity.frameIndex2Time += elapsedTime;
      if (entity.frameIndex1Time > FRAME_DURATION) {
        entity.frameIndex1Time -= FRAME_DURATION;
        entity.frameIndex1 += hero.movingForward ? 1 : -1;
        entity.frameIndex1 += ATLAS.hero.legs.length;
        entity.frameIndex1 %= ATLAS.hero.legs.length;
      }
      if (entity.frameIndex2Time > FRAME_DURATION) {
        entity.frameIndex2Time -= FRAME_DURATION;
        entity.frameIndex2 += 1;
        entity.frameIndex2 %= ATLAS.hero.muzzle_flash.length;
      }
      break;
    case 'scout':
    case 'tank':
      entity.movingRight = entity.velX >= 0;
      entity.frameIndex1Time += elapsedTime;
      entity.frameIndex2Time += elapsedTime;
      if (entity.frameIndex1Time > FRAME_DURATION) {
        entity.frameIndex1Time -= FRAME_DURATION;
        entity.frameIndex1 += 1;
        entity.frameIndex1 %= ATLAS.tank.bite.length;
      }
      if (entity.frameIndex2Time > FRAME_DURATION) {
        entity.frameIndex2Time -= FRAME_DURATION;
        entity.frameIndex2 += 1;
        entity.frameIndex2 %= ATLAS.tank.walk.length;
      }
      break;
    case 'ingress':
      if (!entity.announced && isIngressOpen(entity)) {
        entity.announced = true;
        entities.push(createText('breach in sector ' + entity.name));
      }
      break;
  }
}

function update() {
  switch (screen) {
    case TITLE_SCREEN:
      if (isKeyUp(konamiCode[konamiIndex])) {
        konamiIndex++;
      }
      if (anyKeyDown() || isPointerUp()) {
        setScreen(INTRO_SCREEN);
      }
      break;
    case INTRO_SCREEN:
      if (anyKeyDown() || isPointerUp()) {
        startGame();
      }
      break;
    case GAME_SCREEN:
      if (stopTime < currentTime) {
        if (hero.ded) {
          stopSong();
          setScreen(END_SCREEN);
          return;
        }
        collectHeroInputs();
        handleHeroAttack();
        ingresses = entities.filter(e => e.type === 'ingress');
        ingresses.forEach(spawnEnemy);
        entities.forEach(updateEntityPosition);
        enemies = entities.filter(e => FOE_TYPES.includes(e.type));
        enemies.forEach(handleEnemyVelocity);
        // damage detection
        bullets = entities.filter(e => e.type === 'bullet');
        handleMissileAttacks(bullets, enemies);
        if (blast) {
          handleBlastAttacks(enemies);
        }
        handleMeleeAttacks(enemies);
        
        // position overlap detection
        handleHeroAndEnemiesCollision([...enemies, hero]);
        handleWallsCollision([...bullets, ...enemies, hero]);
  
        entities.forEach(updateEntityTimers);
        updateCameraWindow();
  
        // keep entities with no TTL or TTL in the future
        // remove any with a TTL in the past
        entities = entities.filter(e => !e.ttl || e.ttl > currentTime);
      }
      break;
    case END_SCREEN:
      if (isKeyUp('KeyT')) {
        // TODO can I share an image of the game?
        share({
          title: document.title,
          text: 'I died facing fearful odds playing Stand By Me made by @herebefrogs for #js13k 2022',
          url: 'https://bit.ly/3eBOQS6'
        });
      }
      if (anyKeyDown() || isPointerUp()) {
        setScreen(TITLE_SCREEN);
      }
      break;
  }
};

// RENDER HANDLERS

function blit() {
  // copy camera portion of the backbuffer onto visible canvas, scaling it to screen dimensions
  CTX.drawImage(
    BUFFER,
    cameraX, cameraY, CAMERA_WIDTH, CAMERA_HEIGHT,
    0, 0, c.width, c.height
  );
  CTX.drawImage(
    TEXT,
    0, 0, CAMERA_WIDTH, CAMERA_HEIGHT,
    0, 0, c.width, c.height
  );
};

function render() {
  clearTextBuffer();
  let sprite;

  switch (screen) {
    case TITLE_SCREEN:
      BUFFER_CTX.fillStyle = COLOR_LIGHT_BEIGE;
      BUFFER_CTX.fillRect(0, 0, BUFFER.width, BUFFER.height);
      sprite = ATLAS.AI.health[10];
      TEXT_CTX.drawImage(
        tileset,
        sprite.x, sprite.y, sprite.w, sprite.h,
        CAMERA_WIDTH / 2 - sprite.w, CHARSET_SIZE, 2*sprite.w, 2*sprite.h
      );
      renderText('stand by me', CAMERA_WIDTH / 2, 10*CHARSET_SIZE, ALIGN_CENTER, 3);
      renderText('click / press any key', CAMERA_WIDTH / 2, CAMERA_HEIGHT / 2 + 3*CHARSET_SIZE, ALIGN_CENTER);
      renderText('proudly made in canada', CAMERA_WIDTH / 2, CAMERA_HEIGHT - 6*CHARSET_SIZE, ALIGN_CENTER);
      renderText('jerome lecomte - js13kgames 2022', CAMERA_WIDTH / 2, CAMERA_HEIGHT - 4*CHARSET_SIZE, ALIGN_CENTER);
      renderText('music by ryan malm', CAMERA_WIDTH / 2, CAMERA_HEIGHT - 2*CHARSET_SIZE, ALIGN_CENTER);
      break;
    case INTRO_SCREEN:
      BUFFER_CTX.fillStyle = COLOR_LIGHT_BEIGE;
      BUFFER_CTX.fillRect(0, 0, BUFFER.width, BUFFER.height);
      sprite = ATLAS.AI.health[9];
      TEXT_CTX.drawImage(
        tileset,
        sprite.x, sprite.y, sprite.w, sprite.h,
        CAMERA_WIDTH / 2 - sprite.w, CHARSET_SIZE, 2*sprite.w, 2*sprite.h
      );

      renderText('i am your defense module companion!', CAMERA_WIDTH / 2, 10*CHARSET_SIZE, ALIGN_CENTER);
      renderText('i will stand by your side while', CAMERA_WIDTH / 2, 12*CHARSET_SIZE, ALIGN_CENTER);
      renderText('you protect the central core', CAMERA_WIDTH / 2, 14*CHARSET_SIZE, ALIGN_CENTER);
      renderText('from parasite contamination.', CAMERA_WIDTH / 2, 16*CHARSET_SIZE, ALIGN_CENTER);

      renderText('use wasd/ULDR to move', CAMERA_WIDTH / 2, 24*CHARSET_SIZE, ALIGN_CENTER);
      renderText('use your mouse to aim/fire', CAMERA_WIDTH / 2, 26*CHARSET_SIZE, ALIGN_CENTER);
      renderText('press any key to start', CAMERA_WIDTH / 2, 28*CHARSET_SIZE, ALIGN_CENTER);

      break;
    case GAME_SCREEN:
      // clear backbuffer by drawing static map elements
      BUFFER_CTX.drawImage(MAP, 0, 0, BUFFER.width, BUFFER.height);
      entities.forEach(entity => renderEntity(entity));
      renderCrosshair();
      renderAiHealth();
      // debugCameraWindow();
      break;
    case END_SCREEN:
      BUFFER_CTX.fillStyle = COLOR_LIGHT_BEIGE;
      BUFFER_CTX.fillRect(0, 0, BUFFER.width, BUFFER.height);
      sprite = ATLAS.AI.health[0];
      TEXT_CTX.drawImage(
        tileset,
        sprite.x, sprite.y, sprite.w, sprite.h,
        CAMERA_WIDTH / 2 - sprite.w, CHARSET_SIZE, 2*sprite.w, 2*sprite.h
      );
      renderText('how can one die better', CAMERA_WIDTH / 2, 10*CHARSET_SIZE, ALIGN_CENTER);
      renderText('than facing fearful odds', CAMERA_WIDTH / 2, 12*CHARSET_SIZE, ALIGN_CENTER);
      renderText('for the ashes of their ancestors', CAMERA_WIDTH / 2, 14*CHARSET_SIZE, ALIGN_CENTER);
      renderText('and the temples of their gods?', CAMERA_WIDTH / 2, 16*CHARSET_SIZE, ALIGN_CENTER);
      renderText('[t]weet', CAMERA_WIDTH / 2, CAMERA_HEIGHT - 4*CHARSET_SIZE, ALIGN_CENTER);
      renderText('[r]estart', CAMERA_WIDTH / 2, CAMERA_HEIGHT - 2*CHARSET_SIZE, ALIGN_CENTER);
      break;
  }

  blit();
};

// function debugCameraWindow() {
//   BUFFER_CTX.strokeStyle = '#d00';
//   BUFFER_CTX.lineWidth = 1;
//   BUFFER_CTX.strokeRect(cameraX + CAMERA_WINDOW_X, cameraY + CAMERA_WINDOW_Y, CAMERA_WINDOW_WIDTH, CAMERA_WINDOW_HEIGHT);
// }

function renderCrosshair() {
  BUFFER_CTX.strokeStyle = COLOR_DARK_BLUE;
  BUFFER_CTX.lineWidth = 2;
  const width = hero.attacking ? 10 : 12;
  const offset = hero.attacking ? 5 : 6;

  BUFFER_CTX.strokeRect(crosshair.x - 1, crosshair.y - 1, 2, 2);
  BUFFER_CTX.strokeRect(crosshair.x - offset, crosshair.y - offset, width, width);
}

function renderAiHealth() {
  const i = Math.max(0, ai.hitPoints);
  const sprite = ATLAS.AI.health[i];
  TEXT_CTX.drawImage(
    tileset,
    sprite.x, sprite.y, sprite.w, sprite.h,
    CHARSET_SIZE, CHARSET_SIZE, sprite.w, sprite.h
  );
}

function renderGun() {
  const sheet = hero.aimingRight ? tileset : flipped_tileset;

  BUFFER_CTX.save();
  BUFFER_CTX.translate(hero.w/2, hero.h/2);
  BUFFER_CTX.rotate(hero.gunAngle);
  BUFFER_CTX.translate(hero.w/4, 0);
  const destY = hero.aimingRight ? -2 : -4;
  BUFFER_CTX.drawImage(
    sheet,
    ATLAS.hero.gun.x, ATLAS.hero.gun.y, ATLAS.hero.gun.w, ATLAS.hero.gun.h,
    0, destY, ATLAS.hero.gun.w, ATLAS.hero.gun.h
  );
  BUFFER_CTX.translate(ATLAS.hero.gun.w, 2);
  if (hero.attacking) {
    const sprite = ATLAS.hero.muzzle_flash[hero.frameIndex2];
    const destY = hero.aimingRight ? -6 : -5
    BUFFER_CTX.drawImage(
      sheet,
      sprite.x, sprite.y, sprite.w, sprite.h,
      -1, destY, sprite.w, sprite.h
    );
  }
  BUFFER_CTX.restore();
}

function renderHero() {
  const sheet = hero.aimingRight ? tileset : flipped_tileset;

  if (hero.velX || hero.velY) {
    const torso = ATLAS.hero[hero.movingForward ? 'torso_forward' : 'torso_backward'];
    BUFFER_CTX.drawImage(
      sheet,
      torso.x, torso.y, torso.w, torso.h,
      0, 0, torso.w, torso.h
    );
    const legs = ATLAS.hero.legs[hero.frameIndex1];
    BUFFER_CTX.drawImage(
      sheet,
      legs.x, legs.y, legs.w, legs.h,
      0, torso.h, legs.w, legs.h
    );
  } else {
    BUFFER_CTX.drawImage(
      sheet,
      ATLAS.hero.idle.x, ATLAS.hero.idle.y, ATLAS.hero.idle.w, ATLAS.hero.idle.h,
      0, 0, ATLAS.hero.idle.w, ATLAS.hero.idle.h
    );
  }
}

function renderEntity(entity, ctx = BUFFER_CTX) {
  ctx.save();

  switch (entity.type) {
    case 'hero':
      ctx.translate(Math.round(entity.x), Math.round(entity.y));
      if (entity.gunAngle < 0) {
        renderGun()
        renderHero();
      } else {
        renderHero();
        renderGun()
      }
      break;
    case 'AI':
      ctx.translate(hero.x + hero.w/2, hero.y + hero.h/2);
      ctx.rotate(entity.angle);
      ctx.translate(2.5*entity.w, 0);
      ctx.rotate(-entity.angle);
      ctx.drawImage(
        tileset,
        ATLAS.AI.sprite.x, ATLAS.AI.sprite.y, ATLAS.AI.sprite.w, ATLAS.AI.sprite.h,
        -entity.w/2, -entity.h/2, ATLAS.AI.sprite.w, ATLAS.AI.sprite.h
      );
      break;
    case 'bullet':
      // TODO remove
      ctx.translate(entity.x, entity.y);
      ctx.rotate(entity.angle + Math.PI/2);
      ctx.fillStyle = COLOR_OFF_PALETTE_PURPLE;
      ctx.fillRect(0, 0, entity.w, entity.h);
      break;
    case 'blast':
      ctx.beginPath();
      ctx.lineWidth = entity.w;
      ctx.arc(entity.x, entity.y, entity.radius - entity.w/2, 0, 2 * Math.PI);
      ctx.strokeStyle = COLOR_OFF_PALETTE_BLUE;
      ctx.stroke();
      ctx.closePath();
      break;
    case 'scout':
    case 'tank':
      const sheet = entity.movingRight ? tileset : flipped_tileset;
      const sprite = (entity.invincible || (entity.hitPoints <= 0))
        ? ATLAS[entity.type].hit
        : ATLAS[entity.type][entity.attacking ? 'bite' : 'walk'][entity.attacking ? entity.frameIndex1 : entity.frameIndex2]
      ctx.drawImage(
        sheet,
        sprite.x, sprite.y, sprite.w, sprite.h,
        Math.round(entity.x), Math.round(entity.y), sprite.w, sprite.h
      );
      break;
    case 'text':
      TEXT_CTX.fillStyle = COLOR_DARK_BLUE;
      TEXT_CTX.fillRect(3*ai.w + CHARSET_SIZE, CHARSET_SIZE, CAMERA_WIDTH - (3*ai.w + 2*CHARSET_SIZE), 3*CHARSET_SIZE)
      renderAnimatedText(entity.text, entity.x, entity.y, entity.startTime, currentTime, entity.align, entity.scale)
      break;
    case 'ingress': {
      if (isIngressOpen(entity)) {
        ctx.drawImage(
          tileset,
          80, 32, 16, 16,
          entity.x, entity.y, 16, 16
        );
      }
    }
  }

  ctx.restore();
};

function renderBloodSpot(entity) {
  //FIXME find the sprite, but doesn't render anythng
  const sprite = ATLAS[entity.type].blood;
  MAP_CTX.drawImage(
    tileset,
    sprite.x, sprite.y, sprite.w, sprite.h,
    Math.round(entity.x), Math.round(entity.y), sprite.w, sprite.h
  );
}

function loadMap() {
  MAP_CTX.fillStyle = COLOR_LIGHT_BEIGE;
  MAP_CTX.fillRect(0, 0, MAP.width, MAP.height);

  let u, v;
  // surround the level with a thick wall
  let walls = [
    { x: -32, y: -32, w: 32+MAP.width+32, h: 64},           // top
    { x: -32, y: MAP.height-16, w: 32+MAP.width+32, h: 48}, // bottom
    { x: -32, y: -32, w: 48, h: 32+MAP.height+32},          // left
    { x: MAP.width-16, y: -32, w: 48, h: 32+MAP.height+32}, // right
  ];

  level.split("").forEach((tile, n) => {
    u = n % (MAP.width/16);
    v = Math.floor(n/(MAP.width/16));

    tile = parseInt(tile, 16)
    // walls
    if ([1,2,3,4,5,6,7,8,9,0xb,0xc,0xd,0xe].includes(tile)) {
      // add a collision wall
      const wall = {
        x: 16*u,
        y: 16*v,
        w: 16,
        h: 16
      };

      // draw wall tile
      MAP_CTX.drawImage(
        tileset,
        ATLAS.tiles[tile].x, ATLAS.tiles[tile].y, 16, 16,
        wall.x, wall.y, 16, 16
      );

      // add internal walls, external were already covered above
      if (((u !== 0) && (u !== (MAP.width/16 -1))) ||
          ((v !== 0) && (v !== (MAP.height/16 -1)))) {
        walls.push(wall);
      }
    }
    // central core
    if (tile === 0xa) {
      MAP_CTX.drawImage(
        tileset,
        ATLAS.tiles[tile].x, ATLAS.tiles[tile].y, 32, 27,
        16*u, 16*v, 32, 27
      );

      walls.push({
        x: 16*u,
        y: 16*v,
        w: 32,
        h: 27
      });
    }
    // ingress
    if (tile === 0xf) {
      MAP_CTX.drawImage(
        tileset,
        ATLAS.tiles[tile].x, ATLAS.tiles[tile].y, 16, 16,
        16*u, 16*v, 16, 16
      );
    }
  })

  return walls;
};

// LOOP HANDLERS

function loop() {
  if (running) {
    requestId = requestAnimationFrame(loop);
    currentTime = performance.now();
    elapsedTime = (currentTime - lastTime) / 1000;
    update();
    render();
    lastTime = currentTime;
  }
};

function toggleLoop(value) {
  running = value;
  if (running) {
    lastTime = performance.now();
    loop();
  } else {
    cancelAnimationFrame(requestId);
  }
};

// EVENT HANDLERS

// the real "main" of the game
onload = async (e) => {
  document.title = 'Stand By Me';

  onresize();
  //checkMonetization();

  await initCharset();
  tileset = await loadImg(TILESET);
  flipped_tileset = await loadImg(FLIPPED_TILESET);
  loadSongs();

  toggleLoop(true);
};

onresize = onrotate = function() {
  // scale canvas to fit screen while maintaining aspect ratio
  scaleToFit = Math.min(innerWidth / BUFFER.width, innerHeight / BUFFER.height);
  c.width = BUFFER.width * scaleToFit;
  c.height = BUFFER.height * scaleToFit;

  // disable smoothing on image scaling
  CTX.imageSmoothingEnabled = MAP_CTX.imageSmoothingEnabled = BUFFER_CTX.imageSmoothingEnabled = false;

  // fix key events not received on itch.io when game loads in full screen
  window.focus();
};

// UTILS

document.onvisibilitychange = function(e) {
  // pause loop and game timer when switching tabs
  toggleLoop(!e.target.hidden);
  // pause/resume music too
  if (e.target.hidden) {
    stopSong();
  } else {
    playSong();
  }
};

addEventListener('keydown', e => {
  if (!e.repeat && screen === GAME_SCREEN && e.code === 'KeyP') {
    // Pause game as soon as key is pressed
    toggleLoop(!running);
  }
})

