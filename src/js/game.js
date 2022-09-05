import { isKeyDown, anyKeyDown, isKeyUp } from './inputs/keyboard';
import { isPointerDown, isPointerUp, pointerCanvasPosition } from './inputs/pointer';
import { isMobile } from './mobile';
import { checkMonetization, isMonetizationEnabled } from './monetization';
import { share } from './share';
import { loadSongs, playSound, playSong } from './sound';
import { initSpeech } from './speech';
import { save, load } from './storage';
import { ALIGN_LEFT, ALIGN_CENTER, ALIGN_RIGHT, CHARSET_SIZE, initCharset, renderText, initTextBuffer, clearTextBuffer, renderAnimatedText } from './text';
import { getRandSeed, setRandSeed, lerp, loadImg } from './utils';
import TILESET from '../img/tileset.webp';


const konamiCode = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
let konamiIndex = 0;

// GAMEPLAY VARIABLES

const TITLE_SCREEN = 0;
const GAME_SCREEN = 1;
const END_SCREEN = 2;
let screen = TITLE_SCREEN;

// factor by which to reduce both velX and velY when player moving diagonally
// so they don't seem to move faster than when traveling vertically or horizontally
const RADIUS_ONE_AT_45_DEG = Math.cos(Math.PI / 4);
const TIME_TO_FULL_SPEED = 150;                // in millis, duration till going full speed in any direction

let hero;
let crosshair;  // coordinate in viewport space (add viewportOffset to convert to map space)
let entities;

let speak;

const COLLISION_GROUP_HERO = 1;
const COLLISION_GROUP_FOES = 2;
const INVINCIBLE_DURATION = 250; // in millisecond, time during which a hit entity is immune to further damage

// RENDER VARIABLES

let cameraX = 0;                        // camera/viewport position in map
let cameraY = 0;
const CAMERA_WIDTH = 320;               // camera/viewport size
const CAMERA_HEIGHT = 240;
// camera-window & edge-snapping settings
const CAMERA_WINDOW_X = 100;
const CAMERA_WINDOW_Y = 50;
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
const TEXT = initTextBuffer(c, CAMERA_WIDTH, CAMERA_HEIGHT);  // text buffer


const ATLAS = {
  hero: {
    aiAngle: 0,
    attackRate: 0.1,  // 10 shots per second
    speed: 75,        // px/s
    w: 10,
    h: 10
  },
  AI: {
    speed: Math.PI    // radians/s (half a circle/s)
  },
  bullet: {
    damage: 1,
    speed: 400,
    ttl: Infinity,
    w: 1,
    h: 10
  },
  scout: {
    hitPoints: 1,
    speed: 110,
    w: 10,
    h: 10
  },
  tank: {
    hitPoints: 10,
    speed: 55,
    w: 40,
    h: 40
  }
};

const FRAME_DURATION = 0.1; // duration of 1 animation frame, in seconds
let tileset;   // characters sprite, embedded as a base64 encoded dataurl by build script

// LOOP VARIABLES

let currentTime;
let elapsedTime;
let lastTime;
let requestId;
let running = true;

// GAMEPLAY HANDLERS

function unlockExtraContent() {
  // NOTE: remember to update the value of the monetization meta tag in src/index.html to your payment pointer
}

function startGame() {
  // setRandSeed(getRandSeed());
  // if (isMonetizationEnabled()) { unlockExtraContent() }
  konamiIndex = 0;
  cameraX = cameraY = 0;
  hero = createEntity('hero', COLLISION_GROUP_HERO, CAMERA_WIDTH / 2, CAMERA_HEIGHT / 2);
  crosshair = { x: 0, y: 0 };
  entities = [
    hero,
    {
      startTime: currentTime,
      text: 'how does one die better than facing fearfull odds?',
      ttl: currentTime + 5000,
      type: 'text',
      x: CHARSET_SIZE,
      y: CAMERA_HEIGHT - 2*CHARSET_SIZE,
    },
    createEntity('scout', COLLISION_GROUP_FOES, CAMERA_WIDTH / 6, CHARSET_SIZE),
    createEntity('scout', COLLISION_GROUP_FOES, CAMERA_WIDTH / 3, CHARSET_SIZE),
    createEntity('tank', COLLISION_GROUP_FOES, CAMERA_WIDTH / 2, 2*CHARSET_SIZE),
    createEntity('scout', COLLISION_GROUP_FOES, CAMERA_WIDTH * 2 / 3, CHARSET_SIZE),
    createEntity('scout', COLLISION_GROUP_FOES, CAMERA_WIDTH * 5 / 6, CHARSET_SIZE),
  ];
  renderMap();
  screen = GAME_SCREEN;
};

function testAABBCollision(entity1, entity2) {
  const test = {
    entity1MaxX: entity1.x + entity1.w,
    entity1MaxY: entity1.y + entity1.h,
    entity2MaxX: entity2.x + entity2.w,
    entity2MaxY: entity2.y + entity2.h,
  };

  test.collide = entity1.collisionGroup != entity2.collisionGroup
    && entity1.x < test.entity2MaxX
    && test.entity1MaxX > entity2.x
    && entity1.y < test.entity2MaxY
    && test.entity1MaxY > entity2.y;

  return test;
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

function createEntity(type, collisionGroup, x = 0, y = 0) {
  return {
    ...ATLAS[type], // speed, w, h
    // frame: 0,
    // frameTime: 0,
    collisionGroup,
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

function updateEntityPosition(entity) {
  // velocity component: update position
  if (entity.velX || entity.velY) {
    const scale = entity.velX && entity.velY ? RADIUS_ONE_AT_45_DEG : 1;
    const distance = entity.speed * elapsedTime * scale;
    entity.x += distance * entity.velX;
    entity.y += distance * entity.velY;
  }
};

function updateEntityTimers(entity) {
  // update animation frame
  // entity.frameTime += elapsedTime;
  // if (entity.frameTime > FRAME_DURATION) {
  //   entity.frameTime -= FRAME_DURATION;
  //   entity.frame += 1;
  //   entity.frame %= ATLAS[entity.type][entity.action].length;
  // }
  if (entity.invincibleEndTime < currentTime) {
    entity.invincible = false;
    if (entity.hitPoints <= 0) {
      // no more hitpoints, mark for removal
      entity.ttl = -1;
    }
  }
}

const pointerMapPosition = () => {
  const [x, y] = pointerCanvasPosition(c.width, c.height);
  return [x*CAMERA_WIDTH/c.width + cameraX, y*CAMERA_HEIGHT/c.height + cameraY].map(Math.round);
}

function processInputs() {
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
      [crosshair.x, crosshair.y] = pointerMapPosition();

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
        screen = TITLE_SCREEN;
      }
      break;
  }
}

function fireBullet() {
  const heroCenterX = hero.x+hero.w/2;
  const heroCenterY = hero.y+hero.h/2;

  const [velX, velY, angle] = velocityForTarget(heroCenterX, heroCenterY, crosshair.x, crosshair.y);
  hero.gunAngle = angle;

  if (hero.attacking) {
    hero.attackTime ||= hero.attackRate;  // fire now if hasn't fired yet
    hero.attackTime += elapsedTime;
    if (hero.attackTime > hero.attackRate) {
      hero.attackTime %= hero.attackRate;
      const [x, y] = positionOnCircle(heroCenterX, heroCenterY, 2.5*hero.w, angle)
      entities.push({
        ...createEntity('bullet', COLLISION_GROUP_HERO, x, y),
        angle,
        velX,
        velY,
      })
    }

  } else {
    hero.attackTime = 0;
  }
}

function updateHero() {
  hero.attacking = isPointerDown();

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

  hero.aiAngle += ATLAS['AI'].speed * elapsedTime;
  hero.aiAngle %= 2*Math.PI;
}

function update() {
  processInputs();

  switch (screen) {
    case GAME_SCREEN:
      updateHero();
      entities.forEach(updateEntityPosition);
      fireBullet();
      // damage detection
      bullets = entities.filter(e => e.type === 'bullet');
      enemies = entities.filter(e => e.collisionGroup === COLLISION_GROUP_FOES);
      // missile attacks
      bullets.forEach(bullet => {
        if (bullet.ttl > 0) {
          enemies.forEach(foe => {
            if (!foe.invincible && testAABBCollision(bullet, foe).collide) {
              // enemy damage
              foe.hitPoints -= bullet.damage;
              foe.invincible = true;
              foe.invincibleEndTime = currentTime + INVINCIBLE_DURATION;
              // bullet spent
              bullet.ttl = -1; // NOTE: 0 would behaves like undefined and keep the bullet
            };
          })
        }
      })
      // TODO melee attacks, hero/blastwave agasint enemies

      // TODO all this should be generalized
      // entities between themselves
      // entities against level (which would made constrainToViewport irrelevant
      // and stop bullets from leaving the screen and live forever too)
        // hero to entities collision
        entities.slice(1).forEach((entity) => {
          const test = testAABBCollision(hero, entity);
          if (test.collide) {
            correctAABBCollision(hero, entity, test);
          }
        });
        // hero to level collision
        constrainToViewport(hero);
      entities.forEach(updateEntityTimers);
      updateCameraWindow();
      // keep entities with no TTL or TTL in the future
      // remove any with a TTL in the past
      entities = entities.filter(e => !e.ttl || e.ttl > currentTime);
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
      BUFFER_CTX.fillStyle = '#fff';
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
      // debugCameraWindow();
      break;
    case END_SCREEN:
      BUFFER_CTX.fillStyle = '#fff';
      BUFFER_CTX.fillRect(0, 0, BUFFER.width, BUFFER.height);
      renderText('end screen', CHARSET_SIZE, CHARSET_SIZE);
      // renderText(monetizationEarned(), TEXT.width - CHARSET_SIZE, TEXT.height - 2*CHARSET_SIZE, ALIGN_RIGHT);
      break;
  }

  blit();
};

function debugCameraWindow() {
  BUFFER_CTX.strokeStyle = '#d00';
  BUFFER_CTX.lineWidth = 1;
  BUFFER_CTX.strokeRect(cameraX + CAMERA_WINDOW_X, cameraY + CAMERA_WINDOW_Y, CAMERA_WINDOW_WIDTH, CAMERA_WINDOW_HEIGHT);
}

function renderCrosshair() {
  BUFFER_CTX.strokeStyle = '#fff';
  BUFFER_CTX.lineWidth = 2;
  const width = hero.attacking ? 10 : 12;
  const offset = hero.attacking ? 5 : 6;

  BUFFER_CTX.strokeRect(crosshair.x - 1, crosshair.y - 1, 2, 2);
  BUFFER_CTX.strokeRect(crosshair.x - offset, crosshair.y - offset, width, width);
}

function renderEntity(entity, ctx = BUFFER_CTX) {
  // const sprite = ATLAS[entity.type][entity.action][entity.frame];
  // // TODO skip draw if image outside of visible canvas
  // ctx.drawImage(
  //   tileset,
  //   sprite.x, sprite.y, sprite.w, sprite.h,
  //   Math.round(entity.x - viewportOffsetX), Math.round(entity.y - viewportOffsetY), sprite.w, sprite.h
  // );

  switch (entity.type) {
    case 'hero':
      ctx.save();
      ctx.translate(entity.x, entity.y);
      if (entity.gunAngle < 0) {
        // draw gun
        ctx.save();
        ctx.translate(entity.w/2, entity.h/2);
        ctx.rotate(entity.gunAngle);
        ctx.translate(entity.w/4, 0);
        ctx.fillStyle = '#ee1';
        ctx.fillRect(0, -2, 10, 4);
        ctx.restore();
        // draw hero
        ctx.fillStyle = '#1e1';
        ctx.fillRect(0, 0, entity.w, entity.h);
      } else {
        // draw hero
        ctx.fillStyle = '#1e1';
        ctx.fillRect(0, 0, entity.w, entity.h);
        // draw gun
        ctx.save();
        ctx.translate(entity.w/2, entity.h/2);
        ctx.rotate(entity.gunAngle);
        ctx.translate(entity.w/4, 0);
        ctx.fillStyle = '#ee1';
        ctx.fillRect(0, -2, 10, 4);
        ctx.restore();
      }
      // draw AI
      ctx.translate(entity.w/2, entity.h/2);
      ctx.rotate(entity.aiAngle);
      ctx.translate(2.5*entity.w, 0);
      ctx.rotate(-entity.aiAngle);
      ctx.fillStyle = '#1ee';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
      break;
    case 'bullet':
      ctx.save();
      ctx.translate(entity.x, entity.y);
      ctx.rotate(entity.angle + Math.PI/2);
      ctx.fillStyle = '#e1e';
      ctx.fillRect(0, 0, entity.w, entity.h);
      ctx.restore();
      break;
    case 'scout':
    case 'tank':
      ctx.save();
      ctx.translate(entity.x, entity.y);
      ctx.fillStyle = !entity.hitPoints ? '#e11' : entity.invincible ? '#ee1' : '#11e';
      ctx.fillRect(0, 0, entity.w, entity.h);
      ctx.restore();
      break;
    case 'text':
      renderAnimatedText(entity.text, entity.x, entity.y, entity.startTime, currentTime, entity.align, entity.scale)
      break;
    }
};

function renderMap() {
  MAP_CTX.fillStyle = '#ccc';
  MAP_CTX.fillRect(0, 0, MAP.width, MAP.height);

  MAP_CTX.fillStyle ='#777';
  [0, 2, 4, 6, 8, 10].forEach(x => {
    [0, 2, 4, 6, 8, 10].forEach(y => {
      MAP_CTX.fillRect(x*64, y*48, 64, 48);
      MAP_CTX.fillRect((x+1)*64, (y+1)*48, 64, 48);
    })
  })
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

