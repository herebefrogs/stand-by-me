import { anyKeyDown, isKeyDown, isKeyUp, whichKeyDown } from './inputs/keyboard';
import { isPointerDown, isPointerUp, pointerCanvasPosition } from './inputs/pointer';
import { isMobile } from './mobile';
import { checkMonetization, isMonetizationEnabled } from './monetization';
import { share } from './share';
import { loadSongs, playSound, playSong } from './sound';
import { initSpeech } from './speech';
import { save, load } from './storage';
import { ALIGN_LEFT, ALIGN_CENTER, ALIGN_RIGHT, CHARSET_SIZE, initCharset, renderText, initTextBuffer, clearTextBuffer, renderAnimatedText } from './text';
import { getRandSeed, setRandSeed, lerp, loadImg, rand } from './utils';
import TILESET from '../img/tileset.webp';


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
const INVINCIBLE_DURATION = 250; // in millisecond, time during which a hit entity is immune to further damage

// RENDER VARIABLES

let cameraX = 0;                        // camera/viewport position in map
let cameraY = 0;
const CAMERA_WIDTH = 240;               // camera/viewport size
const CAMERA_HEIGHT = 180;
// camera-window & edge-snapping settings
const CAMERA_WINDOW_X = 50;
const CAMERA_WINDOW_Y = 20;
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
  ingress: {
    odds: {
      tank: 0.15, // %
      scout: 0.85 // %
    },
    rate: 1, // foe per second
    spawnTime: 0,
  }
};

// I am DMC, your Defense Module Companion!
// You must protect the Central Core from infestation.
// I will stand by your side till the bitter end.
// How does one die better than facing fearfull odds?
// Amirite?
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
  cameraX = cameraY = 0;
  hero = createEntity('hero', CAMERA_WIDTH / 2, CAMERA_HEIGHT / 2);
  ai = { type: 'AI', ...ATLAS['AI'] }
  // TODO have a toggle on title screen that only Coil members can switch
  invincibleMode = true;
  crosshair = { x: 0, y: 0 };
  blast = 0;
  entities = [
    hero,
    ai,
    createEntity('scout', CAMERA_WIDTH / 6, CHARSET_SIZE),
    createEntity('scout', CAMERA_WIDTH / 3, CHARSET_SIZE),
    createEntity('tank', CAMERA_WIDTH / 2, 2*CHARSET_SIZE),
    createEntity('scout', CAMERA_WIDTH * 2 / 3, CHARSET_SIZE),
    createEntity('scout', CAMERA_WIDTH * 5 / 6, CHARSET_SIZE),
    { type: 'ingress', x: 0, y: CAMERA_HEIGHT / 2, ...ATLAS['ingress'] },
  ];
  stopTime = 0;
  renderMap();
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

// entity1 collided into entity2
function correctAABBCollision(entity1, entity2, test) {
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

function constrainToViewport(entity) {
  if (entity.x < 0) {
    entity.x = 0;
  } else if (entity.x > MAP.width - entity.w) {
    entity.x = MAP.width - entity.w;
  }
  if (entity.y < 0) {
    entity.y = 0;
  } else if (entity.y > MAP.height - entity.h) {
    entity.y = MAP.height - entity.h;
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
    AI_HEALTH_CHAT[ai.hitPoints],
    5000,
    3*ai.w + CHARSET_SIZE,
    2*CHARSET_SIZE,
  ));
}

const createText = (text, duration, x, y, align, scale) => ({
  align,
  scale,
  startTime: currentTime,
  text,
  ttl: currentTime + duration,
  type: 'text',
  x,
  y
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

function spawnEnemy(ingress) {
  if (ingress.spawnTime < currentTime) {
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
  const entityCenterX = entity.x+entity.w/2;
  const entityCenterY = entity.y+entity.h/2;

  // TODO decide whether aiming for the central core or the player
  const heroCenterX = hero.x+hero.w/2;
  const heroCenterY = hero.y+hero.h/2;

  [entity.velX, entity.velY, _] = velocityForTarget(entityCenterX, entityCenterY, heroCenterX, heroCenterY);
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
      entity.frameIndex1Time += elapsedTime;
      entity.frameIndex2Time += elapsedTime;
      if (entity.frameIndex1Time > FRAME_DURATION) {
        entity.frameIndex1Time -= FRAME_DURATION;
        const aimingRight = (-Math.PI/2 < hero.gunAngle) && (hero.gunAngle < Math.PI / 2)
        entity.frameIndex1 += (aimingRight && (hero.velX >= 0)) || (!aimingRight && (hero.velX < 0)) ? 1 : -1;
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

  }
}

function update() {
  switch (screen) {
    case TITLE_SCREEN:
      if (isKeyUp(konamiCode[konamiIndex])) {
        konamiIndex++;
      }
      if (anyKeyDown() || isPointerUp()) {
        startGame();
      }
      break;
    case GAME_SCREEN:
      if (stopTime < currentTime) {
        if (hero.ded) {
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
        const colliders = [...enemies, hero];
        colliders.forEach((entity1, i) => {
          colliders.slice(i+1).forEach(entity2 => {
            const test = testAABBCollision(entity1, entity2);
            // TODO damn, foes don't collide with each other because they're in the same group!!!
            // must rethink groups
            if (test.collide) {
              correct2EntitiesCollision(entity1, entity2, test);
  
            }
          })
        })
        // TODO bullets, hero, enemies against level
        // will make constrainToViewport obsolete
        constrainToViewport(hero);
  
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
          text: 'Check this game template made by @herebefrogs',
          url: 'https://bit.ly/gmjblp'
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

  switch (screen) {
    case TITLE_SCREEN:
      BUFFER_CTX.fillStyle = '#edc';
      BUFFER_CTX.fillRect(0, 0, BUFFER.width, BUFFER.height);
      renderText('title screen', CHARSET_SIZE, CHARSET_SIZE);
      renderText(isMobile ? 'tap to start' : 'press any key', CAMERA_WIDTH / 2, CAMERA_HEIGHT / 2, ALIGN_CENTER);
      if (konamiIndex === konamiCode.length) {
        renderText('konami mode on', BUFFER.width - CHARSET_SIZE, CHARSET_SIZE, ALIGN_RIGHT);
      }
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
      BUFFER_CTX.fillStyle = '#edc';
      BUFFER_CTX.fillRect(0, 0, BUFFER.width, BUFFER.height);
      renderText('end screen', CHARSET_SIZE, CHARSET_SIZE);
      renderText('you ded', CAMERA_WIDTH / 2, CAMERA_HEIGHT / 2, ALIGN_CENTER);
      // renderText(monetizationEarned(), TEXT.width - CHARSET_SIZE, TEXT.height - 2*CHARSET_SIZE, ALIGN_RIGHT);
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
  BUFFER_CTX.strokeStyle = '#248';
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
  BUFFER_CTX.save();
  BUFFER_CTX.translate(hero.w/2, hero.h/2);
  BUFFER_CTX.rotate(hero.gunAngle);
  BUFFER_CTX.translate(hero.w/4, 0);
  BUFFER_CTX.drawImage(
    tileset,
    ATLAS.hero.gun.x, ATLAS.hero.gun.y, ATLAS.hero.gun.w, ATLAS.hero.gun.h,
    0, -2, ATLAS.hero.gun.w, ATLAS.hero.gun.h
  );
  BUFFER_CTX.translate(ATLAS.hero.gun.w, 2);
  if (hero.attacking) {
    const sprite = ATLAS.hero.muzzle_flash[hero.frameIndex2];
    BUFFER_CTX.drawImage(
      tileset,
      sprite.x, sprite.y, sprite.w, sprite.h,
      -1, -ATLAS.hero.gun.h, sprite.w, sprite.h
    );
  }
  BUFFER_CTX.restore();
}

function renderHero() {
  if (hero.velX || hero.velY) {
    const torso = ATLAS.hero.torso_forward;
    BUFFER_CTX.drawImage(
      tileset,
      torso.x, torso.y, torso.w, torso.h,
      0, 0, torso.w, torso.h
    );
    const legs = ATLAS.hero.legs[hero.frameIndex1];
    BUFFER_CTX.drawImage(
      tileset,
      legs.x, legs.y, legs.w, legs.h,
      0, torso.h, legs.w, legs.h
    );
  } else {
    BUFFER_CTX.drawImage(
      tileset,
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
      ctx.fillStyle = '#e1e';
      ctx.fillRect(0, 0, entity.w, entity.h);
      break;
    case 'blast':
      ctx.beginPath();
      ctx.lineWidth = entity.w;
      ctx.arc(entity.x, entity.y, entity.radius - entity.w/2, 0, 2 * Math.PI);
      ctx.strokeStyle = '#1ee';
      ctx.stroke();
      ctx.closePath();
      break;
    case 'scout':
    case 'tank':
      const sprite = ATLAS[entity.type][entity.attacking ? 'bite' : 'walk'][entity.attacking ? entity.frameIndex1 : entity.frameIndex2];
      ctx.drawImage(
        tileset,
        sprite.x, sprite.y, sprite.w, sprite.h,
        Math.round(entity.x), Math.round(entity.y), sprite.w, sprite.h
      );
      break;
    case 'text':
      renderAnimatedText(entity.text, entity.x, entity.y, entity.startTime, currentTime, entity.align, entity.scale)
      break;
  }

  ctx.restore();
};

function renderBloodSpot(entity) {
  //FIXME find the sprite, but doesn't render anythng
  const sprite = ATLAS[entity.type].blood;
  BUFFER_CTX.drawImage(
    tileset,
    sprite.x, sprite.y, sprite.w, sprite.h,
    Math.round(entity.x), Math.round(entity.y), sprite.w, sprite.h
  );
}

function renderMap() {
  MAP_CTX.fillStyle = '#edc';
  MAP_CTX.fillRect(0, 0, MAP.width, MAP.height);

  // MAP_CTX.fillStyle ='#777';
  // [0, 2, 4, 6, 8, 10].forEach(x => {
  //   [0, 2, 4, 6, 8, 10].forEach(y => {
  //     MAP_CTX.fillRect(x*64, y*48, 64, 48);
  //     MAP_CTX.fillRect((x+1)*64, (y+1)*48, 64, 48);
  //   })
  // })
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
  // speak = await initSpeech();

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
};

addEventListener('keydown', e => {
  if (!e.repeat && screen === GAME_SCREEN && e.code === 'KeyP') {
    // Pause game as soon as key is pressed
    toggleLoop(!running);
  }
})

