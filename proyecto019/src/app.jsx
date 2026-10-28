import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import './index.css';
import './app.css';

const PROFILE_KEY = 'aventura-arcade-profile-v1';
const BOARD_SIZE = 16;
const INITIAL_PROFILE = { name: 'Aventurero', xp: 0, history: [] };
const GAMES = [
  { id: 'snake', title: 'Culebrita', subtitle: 'Come, crece y evita chocar.', icon: '🐍', unlockLevel: 1, color: 'mint' },
  { id: 'math', title: 'Cálculo relámpago', subtitle: 'Resuelve operaciones y multiplica tu racha.', icon: '⚡', unlockLevel: 2, color: 'peach' },
  { id: 'memory', title: 'Memoria cósmica', subtitle: 'Encuentra parejas escondidas entre las estrellas.', icon: '🌌', unlockLevel: 2, color: 'lilac' },
  { id: 'number', title: 'Código secreto', subtitle: 'Descifra el número con pistas de mayor o menor.', icon: '🔐', unlockLevel: 2, color: 'mint' },
  { id: 'escape', title: 'Escape: sala secreta', subtitle: 'Resuelve acertijos y encuentra la salida.', icon: '🗝️', unlockLevel: 3, color: 'lilac' },
  { id: 'simon', title: 'Eco de colores', subtitle: 'Repite la secuencia y pon a prueba tu memoria.', icon: '🎨', unlockLevel: 3, color: 'peach' },
  { id: 'tictactoe', title: 'Gato galáctico', subtitle: 'Vence al robot en un duelo de tres en línea.', icon: '⭕', unlockLevel: 3, color: 'mint' },
  { id: 'word', title: 'Palabra revuelta', subtitle: 'Ordena las letras antes de gastar tus intentos.', icon: '🔤', unlockLevel: 4, color: 'peach' },
  { id: 'reflex', title: '¡Toque relámpago!', subtitle: 'Espera la señal y toca tan rápido como puedas.', icon: '👆', unlockLevel: 4, color: 'lilac' },
  { id: 'maze', title: 'Laberinto brillante', subtitle: 'Encuentra la salida con el menor número de pasos.', icon: '🧭', unlockLevel: 5, color: 'mint' },
];
const MEMORY_SYMBOLS = ['🌙', '🪐', '🚀', '👾'];
const SIMON_COLORS = [
  { id: 'coral', label: 'Coral', emoji: '🟥' },
  { id: 'blue', label: 'Azul', emoji: '🟦' },
  { id: 'yellow', label: 'Amarillo', emoji: '🟨' },
  { id: 'green', label: 'Verde', emoji: '🟩' },
];
const WORDS = [
  { word: 'PLANETA', hint: 'Un mundo que gira alrededor de una estrella.' },
  { word: 'COHETE', hint: 'Vehículo que viaja al espacio.' },
  { word: 'ESTRELLA', hint: 'Brilla en el cielo y tiene luz propia.' },
  { word: 'BOSQUE', hint: 'Un lugar lleno de árboles.' },
  { word: 'DRAGON', hint: 'Criatura fantástica que lanza fuego.' },
  { word: 'TECLADO', hint: 'Tiene letras y lo usas para escribir.' },
];
const MAZE_SIZE = 7;
const MAZE_WALLS = new Set([
  '0,1', '1,1', '2,1', '4,1', '5,1',
  '0,2', '4,2', '5,2', '6,2',
  '2,3', '3,3', '4,3', '6,3',
  '0,4', '5,4', '6,4',
  '0,5', '2,5', '3,5', '5,5',
  '0,6', '1,6', '2,6', '3,6',
]);
const ESCAPE_ROOMS = [
  { room: 'La puerta azul', story: 'Una nota dice: “Tengo agujas, pero no sé coser. ¿Qué soy?”', hint: 'Te ayuda a saber la hora.', answer: 'Un reloj', options: ['Un reloj', 'Un erizo', 'Un pino'] },
  { room: 'El pasillo oscuro', story: '¿Qué se hace más grande cuanto más le quitas?', hint: 'Piensa en un hueco en el suelo.', answer: 'Un agujero', options: ['Un agujero', 'Una vela', 'Una sombra'] },
  { room: 'La biblioteca', story: 'Tengo ciudades sin casas y ríos sin agua. ¿Qué soy?', hint: 'Lo consultas para encontrar un lugar.', answer: 'Un mapa', options: ['Un mapa', 'Un libro', 'Un espejo'] },
  { room: 'El laboratorio', story: 'Dos padres y dos hijos comen tres manzanas. Cada uno come una. ¿Cómo es posible?', hint: 'En realidad son solo tres personas.', answer: 'Son abuelo, padre e hijo', options: ['Son abuelo, padre e hijo', 'Una manzana era falsa', 'Uno no tenía hambre'] },
  { room: 'La salida', story: 'Si me nombras, desaparezco. ¿Qué soy?', hint: 'Hace falta para escuchar los acertijos.', answer: 'El silencio', options: ['El silencio', 'El aire', 'La noche'] },
];

function loadProfile() {
  try {
    const saved = window.localStorage.getItem(PROFILE_KEY);
    if (!saved) return INITIAL_PROFILE;
    const profile = JSON.parse(saved);
    if (
      typeof profile.name !== 'string' ||
      !Number.isFinite(profile.xp) ||
      !Array.isArray(profile.history)
    ) {
      throw new Error('El perfil guardado no tiene el formato esperado.');
    }
    return {
      name: profile.name || INITIAL_PROFILE.name,
      xp: Math.max(0, profile.xp),
      history: profile.history.filter(
        (run) => run && typeof run.gameId === 'string' && Number.isFinite(run.score),
      ),
    };
  } catch (error) {
    console.error('No se pudo leer el perfil guardado:', error);
    return INITIAL_PROFILE;
  }
}

function getLevelProgress(xp) {
  let level = 1;
  let remaining = xp;
  let nextLevelCost = 80;
  while (remaining >= nextLevelCost) {
    remaining -= nextLevelCost;
    level += 1;
    nextLevelCost += 40;
  }
  return { level, progress: remaining, nextLevelCost };
}

function makeMathQuestion(level) {
  const max = Math.min(12 + level * 4, 60);
  const operations = level < 3 ? ['+', '-'] : ['+', '-', '×', '÷'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  let left;
  let right;
  let answer;

  if (operation === '+') {
    left = Math.ceil(Math.random() * max);
    right = Math.ceil(Math.random() * max);
    answer = left + right;
  } else if (operation === '-') {
    left = Math.ceil(Math.random() * max);
    right = Math.ceil(Math.random() * max);
    if (right > left) [left, right] = [right, left];
    answer = left - right;
  } else if (operation === '×') {
    left = Math.ceil(Math.random() * Math.min(level + 5, 12));
    right = Math.ceil(Math.random() * Math.min(level + 5, 12));
    answer = left * right;
  } else {
    right = Math.ceil(Math.random() * Math.min(level + 5, 12));
    answer = Math.ceil(Math.random() * Math.min(level + 5, 12));
    left = right * answer;
  }

  const choices = new Set([answer]);
  while (choices.size < 4) {
    const offset = Math.ceil(Math.random() * 10) * (Math.random() < 0.5 ? -1 : 1);
    choices.add(Math.max(0, answer + offset));
  }
  return { expression: `${left} ${operation} ${right}`, answer, choices: [...choices].sort(() => Math.random() - 0.5) };
}

function createFood(snake) {
  const available = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!snake.some((part) => part.x === x && part.y === y)) available.push({ x, y });
    }
  }
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function shuffleList(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

function findTicTacToeWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  const line = lines.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
  return line ? board[line[0]] : board.every(Boolean) ? 'draw' : null;
}

function App() {
  const [profile, setProfile] = useState(loadProfile);
  const [storageError, setStorageError] = useState(false);
  const [page, setPage] = useState('games');
  const [screen, setScreen] = useState('lobby');
  const [activeGame, setActiveGame] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [snake, setSnake] = useState([{ x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }]);
  const [food, setFood] = useState({ x: 11, y: 8 });
  const [snakeStatus, setSnakeStatus] = useState('playing');
  const [snakeSpeed, setSnakeSpeed] = useState(180);
  const [mathRun, setMathRun] = useState(null);
  const [memoryRun, setMemoryRun] = useState(null);
  const [numberRun, setNumberRun] = useState(null);
  const [escapeRun, setEscapeRun] = useState(null);
  const [simonRun, setSimonRun] = useState(null);
  const [ticRun, setTicRun] = useState(null);
  const [wordRun, setWordRun] = useState(null);
  const [reflexRun, setReflexRun] = useState(null);
  const [mazeRun, setMazeRun] = useState(null);
  const [wordGuess, setWordGuess] = useState('');
  const [simonHighlight, setSimonHighlight] = useState(null);
  const snakeRef = useRef(snake);
  const directionRef = useRef({ x: 1, y: 0 });
  const finishedRef = useRef(false);
  const memoryMismatchTimerRef = useRef(null);

  snakeRef.current = snake;
  const levelInfo = useMemo(() => getLevelProgress(profile.xp), [profile.xp]);
  const gameCounts = useMemo(() => profile.history.reduce((counts, run) => {
    counts[run.gameId] = (counts[run.gameId] || 0) + 1;
    return counts;
  }, {}), [profile.history]);
  const favoriteGame = useMemo(() => {
    const favoriteId = Object.keys(gameCounts).sort((a, b) => gameCounts[b] - gameCounts[a])[0];
    return GAMES.find((game) => game.id === favoriteId) || null;
  }, [gameCounts]);
  const highScores = useMemo(() => GAMES.map((game) => ({
    ...game,
    best: profile.history
      .filter((run) => run.gameId === game.id)
      .reduce((best, run) => Math.max(best, run.score), 0),
  })), [profile.history]);
  const totalRuns = profile.history.length;

  useEffect(() => {
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      setStorageError(false);
    } catch (error) {
      console.error('No se pudo guardar el perfil:', error);
      setStorageError(true);
    }
  }, [profile]);

  useEffect(() => {
    if (screen !== 'memory' && memoryMismatchTimerRef.current) {
      window.clearTimeout(memoryMismatchTimerRef.current);
      memoryMismatchTimerRef.current = null;
    }
  }, [screen]);

  const finishRun = useCallback((gameId, score, message) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const earned = Math.max(0, Math.round(score));
    const game = GAMES.find((item) => item.id === gameId);
    const result = { gameId, title: game?.title || 'Minijuego', score: earned, message };
    setLastResult(result);
    setProfile((current) => ({
      ...current,
      xp: current.xp + earned,
      history: [{ id: `${Date.now()}-${Math.random()}`, gameId, score: earned, date: new Date().toISOString() }, ...current.history],
    }));
    setScreen('result');
  }, []);

  const startGame = (gameId) => {
    const game = GAMES.find((item) => item.id === gameId);
    if (!game || levelInfo.level < game.unlockLevel) return;
    if (memoryMismatchTimerRef.current) {
      window.clearTimeout(memoryMismatchTimerRef.current);
      memoryMismatchTimerRef.current = null;
    }
    finishedRef.current = false;
    setActiveGame(gameId);
    setPage('games');
    if (gameId === 'snake') {
      const startingSnake = [{ x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }];
      setSnake(startingSnake);
      setFood(createFood(startingSnake));
      directionRef.current = { x: 1, y: 0 };
      setSnakeSpeed(180);
      setSnakeStatus('playing');
      setScreen('snake');
    } else if (gameId === 'math') {
      setMathRun({
        questions: Array.from({ length: 10 }, () => makeMathQuestion(levelInfo.level)),
        index: 0,
        score: 0,
        streak: 0,
        feedback: null,
      });
      setScreen('math');
    } else if (gameId === 'memory') {
      const cards = shuffleList([...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS].map((symbol, index) => ({
        id: `${symbol}-${index}`,
        symbol,
      })));
      setMemoryRun({ cards, opened: [], matched: [], moves: 0, locked: false, score: 0 });
      setScreen('memory');
    } else if (gameId === 'number') {
      setNumberRun({ target: Math.ceil(Math.random() * 50), attempts: 0, guesses: [], feedback: '' });
      setScreen('number');
    } else if (gameId === 'escape') {
      setEscapeRun({ index: 0, score: 0, attempts: 0, hintOpen: false, feedback: null });
      setScreen('escape');
    } else if (gameId === 'simon') {
      setSimonRun({
        sequence: Array.from({ length: 3 }, () => SIMON_COLORS[Math.floor(Math.random() * SIMON_COLORS.length)].id),
        round: 1,
        score: 0,
        input: [],
        phase: 'watch',
      });
      setSimonHighlight(null);
      setScreen('simon');
    } else if (gameId === 'tictactoe') {
      setTicRun({ board: Array(9).fill(null), turn: 'player', result: null });
      setScreen('tictactoe');
    } else if (gameId === 'word') {
      const selected = WORDS[Math.floor(Math.random() * WORDS.length)];
      let letters = shuffleList(selected.word.split('')).join('');
      while (letters === selected.word) letters = shuffleList(selected.word.split('')).join('');
      setWordRun({ ...selected, letters, attempts: 0, hintOpen: false, feedback: '' });
      setWordGuess('');
      setScreen('word');
    } else if (gameId === 'reflex') {
      setReflexRun({ round: 1, score: 0, phase: 'waiting', startedAt: null, message: 'Espera a que aparezca la señal…' });
      setScreen('reflex');
    } else if (gameId === 'maze') {
      setMazeRun({ x: 0, y: 0, steps: 0 });
      setScreen('maze');
    }
  };

  const moveSnake = useCallback((direction) => {
    const currentDirection = directionRef.current;
    if (direction.x + currentDirection.x === 0 && direction.y + currentDirection.y === 0) return;
    directionRef.current = direction;
  }, []);

  const quitGame = async () => {
    const result = await Swal.fire({
      icon: 'question',
      title: '¿Salir de la partida?',
      text: 'Guardaremos los puntos que hayas conseguido hasta ahora.',
      showCancelButton: true,
      confirmButtonText: 'Guardar y salir',
      cancelButtonText: 'Seguir jugando',
      confirmButtonColor: '#6c5ce7',
    });
    if (!result.isConfirmed) return;
    if (memoryMismatchTimerRef.current) {
      window.clearTimeout(memoryMismatchTimerRef.current);
      memoryMismatchTimerRef.current = null;
    }
    const scoreByGame = {
      snake: (snake.length - 3) * 10,
      math: mathRun?.score || 0,
      memory: memoryRun?.score || 0,
      number: 0,
      escape: escapeRun?.score || 0,
      simon: simonRun?.score || 0,
      tictactoe: ticRun?.result === 'win' ? 50 : ticRun?.result === 'draw' ? 25 : 0,
      word: 0,
      reflex: reflexRun?.score || 0,
      maze: 0,
    };
    const score = scoreByGame[activeGame] || 0;
    finishRun(activeGame, score, 'Partida guardada. ¡La próxima puedes llegar aún más lejos!');
  };

  useEffect(() => {
    if (screen !== 'snake' || snakeStatus !== 'playing') return undefined;
    const timer = window.setInterval(() => {
      const currentSnake = snakeRef.current;
      const direction = directionRef.current;
      const head = { x: currentSnake[0].x + direction.x, y: currentSnake[0].y + direction.y };
      const foundFood = head.x === food.x && head.y === food.y;
      const body = foundFood ? currentSnake : currentSnake.slice(0, -1);
      if (
        head.x < 0 || head.y < 0 || head.x >= BOARD_SIZE || head.y >= BOARD_SIZE ||
        body.some((part) => part.x === head.x && part.y === head.y)
      ) {
        setSnakeStatus('over');
        finishRun('snake', (currentSnake.length - 3) * 10, '¡Buena partida! Cada manzana suma 10 puntos.');
        return;
      }
      const nextSnake = [head, ...currentSnake];
      if (foundFood) {
        const nextFood = createFood(nextSnake);
        if (!nextFood) {
          setSnake(nextSnake);
          setSnakeStatus('over');
          finishRun('snake', (nextSnake.length - 3) * 10, '¡Llenaste todo el tablero! ¡Victoria perfecta!');
          return;
        }
        setFood(nextFood);
        setSnakeSpeed((speed) => Math.max(75, speed - 6));
      } else {
        nextSnake.pop();
      }
      setSnake(nextSnake);
    }, snakeSpeed);
    return () => window.clearInterval(timer);
  }, [screen, snakeStatus, snakeSpeed, food, finishRun]);

  useEffect(() => {
    if (screen !== 'simon' || !simonRun || simonRun.phase !== 'watch') return undefined;
    const timers = [];
    simonRun.sequence.forEach((color, index) => {
      timers.push(window.setTimeout(() => setSimonHighlight(color), index * 650));
      timers.push(window.setTimeout(() => setSimonHighlight(null), index * 650 + 340));
    });
    timers.push(window.setTimeout(() => {
      setSimonHighlight(null);
      setSimonRun((current) => current ? { ...current, phase: 'input' } : current);
    }, simonRun.sequence.length * 650));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [screen, simonRun]);

  useEffect(() => {
    if (screen !== 'reflex' || !reflexRun || reflexRun.phase !== 'waiting') return undefined;
    const timer = window.setTimeout(() => {
      setReflexRun((current) => current?.phase === 'waiting'
        ? { ...current, phase: 'go', startedAt: Date.now(), message: '¡AHORA! Toca el botón' }
        : current);
    }, 1000 + Math.floor(Math.random() * 1800));
    return () => window.clearTimeout(timer);
  }, [screen, reflexRun]);

  useEffect(() => {
    if (screen !== 'snake' || snakeStatus !== 'playing') return undefined;
    const onKeyDown = (event) => {
      const directions = {
        ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
      };
      if (directions[event.key]) {
        event.preventDefault();
        moveSnake(directions[event.key]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, snakeStatus, moveSnake]);

  const answerMath = (choice) => {
    if (!mathRun || mathRun.feedback) return;
    const question = mathRun.questions[mathRun.index];
    if (choice === question.answer) {
      const streak = mathRun.streak + 1;
      const earned = 8 + Math.min(streak, 5) * 2;
      setMathRun({ ...mathRun, score: mathRun.score + earned, streak, feedback: `¡Correcto! +${earned} puntos` });
    } else {
      setMathRun({ ...mathRun, streak: 0, feedback: `Casi. La respuesta era ${question.answer}. ¡Sigue!` });
    }
  };

  const nextMathQuestion = () => {
    if (!mathRun) return;
    if (mathRun.index === mathRun.questions.length - 1) {
      finishRun('math', mathRun.score, '¡Ronda completada! Tu racha también suma puntos.');
      return;
    }
    setMathRun({ ...mathRun, index: mathRun.index + 1, feedback: null });
  };

  const answerEscape = (choice) => {
    if (!escapeRun || escapeRun.feedback?.startsWith('¡')) return;
    const room = ESCAPE_ROOMS[escapeRun.index];
    if (choice === room.answer) {
      const earned = escapeRun.attempts > 0 || escapeRun.hintOpen ? 15 : 25;
      setEscapeRun({ ...escapeRun, score: escapeRun.score + earned, feedback: `¡Acertijo resuelto! +${earned} puntos` });
    } else {
      setEscapeRun({ ...escapeRun, attempts: escapeRun.attempts + 1, feedback: 'Esa no era. Prueba otra vez; puedes usar una pista.' });
    }
  };

  const flipMemoryCard = (cardId) => {
    if (!memoryRun || memoryRun.locked || memoryRun.opened.length >= 2) return;
    if (memoryRun.matched.includes(cardId) || memoryRun.opened.includes(cardId)) return;
    const opened = [...memoryRun.opened, cardId];
    if (opened.length === 1) {
      setMemoryRun({ ...memoryRun, opened });
      return;
    }

    const moves = memoryRun.moves + 1;
    const firstCard = memoryRun.cards.find((card) => card.id === opened[0]);
    const secondCard = memoryRun.cards.find((card) => card.id === opened[1]);
    if (firstCard.symbol === secondCard.symbol) {
      const matched = [...memoryRun.matched, ...opened];
      const score = memoryRun.score + 15;
      if (matched.length === memoryRun.cards.length) {
        const bonus = moves <= 8 ? 15 : 0;
        setMemoryRun({ ...memoryRun, matched, opened: [], moves, score: score + bonus });
        finishRun('memory', score + bonus, `¡Encontraste todas las parejas!${bonus ? ' Bono de memoria perfecta: +15 XP.' : ''}`);
      } else {
        setMemoryRun({ ...memoryRun, matched, opened: [], moves, score });
      }
      return;
    }

    setMemoryRun({ ...memoryRun, opened, moves, locked: true });
    memoryMismatchTimerRef.current = window.setTimeout(() => {
      memoryMismatchTimerRef.current = null;
      setMemoryRun((current) => current ? { ...current, opened: [], locked: false } : current);
    }, 750);
  };

  const guessNumber = (event) => {
    event.preventDefault();
    if (!numberRun) return;
    const guess = Number(event.currentTarget.elements.guess.value);
    if (!Number.isInteger(guess) || guess < 1 || guess > 50) return;
    const guesses = [...numberRun.guesses, guess];
    const attempts = numberRun.attempts + 1;
    const isCorrect = guess === numberRun.target;
    const score = Math.max(10, 40 - (attempts - 1) * 5);
    if (isCorrect) {
      finishRun('number', score, `¡Descifraste el código en ${attempts} ${attempts === 1 ? 'intento' : 'intentos'}!`);
      return;
    }
    if (attempts >= 7) {
      finishRun('number', 5, `El código era ${numberRun.target}. ¡Te llevas 5 XP de consolación!`);
      return;
    }
    setNumberRun({
      ...numberRun,
      attempts,
      guesses,
      feedback: guess < numberRun.target ? 'El código secreto es MÁS ALTO.' : 'El código secreto es MÁS BAJO.',
    });
    event.currentTarget.reset();
  };

  const tapSimonColor = (colorId) => {
    if (!simonRun || simonRun.phase !== 'input') return;
    const input = [...simonRun.input, colorId];
    if (input[input.length - 1] !== simonRun.sequence[input.length - 1]) {
      finishRun('simon', simonRun.score, `¡Buen intento! Completaste ${simonRun.round - 1} rondas de memoria.`);
      return;
    }
    if (input.length === simonRun.sequence.length) {
      const score = simonRun.score + 15;
      if (simonRun.round === 5) {
        finishRun('simon', score, '¡Memoria galáctica perfecta! Completaste las cinco secuencias.');
        return;
      }
      setSimonRun({
        ...simonRun,
        sequence: [...simonRun.sequence, SIMON_COLORS[Math.floor(Math.random() * SIMON_COLORS.length)].id],
        round: simonRun.round + 1,
        score,
        input: [],
        phase: 'watch',
      });
      return;
    }
    setSimonRun({ ...simonRun, input });
  };

  const playTicTacToe = (cellIndex) => {
    if (!ticRun || ticRun.turn !== 'player' || ticRun.board[cellIndex]) return;
    const playerBoard = [...ticRun.board];
    playerBoard[cellIndex] = 'X';
    const playerResult = findTicTacToeWinner(playerBoard);
    if (playerResult === 'X') {
      setTicRun({ board: playerBoard, turn: 'done', result: 'win' });
      finishRun('tictactoe', 50, '¡Tres en línea! Derrotaste al robot y ganaste la partida.');
      return;
    }
    if (playerResult === 'draw') {
      setTicRun({ board: playerBoard, turn: 'done', result: 'draw' });
      finishRun('tictactoe', 25, '¡Empate espacial! Te llevas 25 XP por el duelo.');
      return;
    }

    const available = playerBoard.map((cell, index) => cell ? -1 : index).filter((index) => index >= 0);
    const winningMove = available.find((index) => {
      const trial = [...playerBoard];
      trial[index] = 'O';
      return findTicTacToeWinner(trial) === 'O';
    });
    const blockingMove = available.find((index) => {
      const trial = [...playerBoard];
      trial[index] = 'X';
      return findTicTacToeWinner(trial) === 'X';
    });
    const cpuMove = winningMove ?? blockingMove ?? available[Math.floor(Math.random() * available.length)];
    const cpuBoard = [...playerBoard];
    cpuBoard[cpuMove] = 'O';
    const cpuResult = findTicTacToeWinner(cpuBoard);
    if (cpuResult === 'O') {
      setTicRun({ board: cpuBoard, turn: 'done', result: 'loss' });
      finishRun('tictactoe', 5, 'El robot ganó esta ronda. ¡Te llevas 5 XP por intentarlo!');
      return;
    }
    const drawResult = findTicTacToeWinner(cpuBoard);
    if (drawResult === 'draw') {
      setTicRun({ board: cpuBoard, turn: 'done', result: 'draw' });
      finishRun('tictactoe', 25, '¡Empate espacial! Te llevas 25 XP por el duelo.');
      return;
    }
    setTicRun({ board: cpuBoard, turn: 'player', result: null });
  };

  const submitWord = (event) => {
    event.preventDefault();
    if (!wordRun) return;
    const attempts = wordRun.attempts + 1;
    if (wordGuess.trim().toLocaleUpperCase() === wordRun.word) {
      finishRun('word', Math.max(15, 40 - (attempts - 1) * 10), `¡Palabra descubierta en ${attempts} ${attempts === 1 ? 'intento' : 'intentos'}!`);
      return;
    }
    if (attempts >= 3) {
      finishRun('word', 5, `La palabra era ${wordRun.word}. ¡Sigue practicando!`);
      return;
    }
    setWordRun({ ...wordRun, attempts, feedback: 'Todavía no. Reordena las letras e inténtalo otra vez.' });
    setWordGuess('');
  };

  const tapReflex = () => {
    if (!reflexRun) return;
    if (reflexRun.phase === 'waiting') {
      if (reflexRun.round === 5) {
        finishRun('reflex', reflexRun.score, `Terminaste la ronda con ${reflexRun.score} XP. ¡La próxima espera la señal!`);
      } else {
        setReflexRun({
          ...reflexRun,
          round: reflexRun.round + 1,
          phase: 'waiting',
          startedAt: null,
          message: '¡Muy pronto! Espera a que aparezca la señal…',
        });
      }
      return;
    }
    if (reflexRun.phase !== 'go') return;
    const reaction = Date.now() - reflexRun.startedAt;
    const earned = Math.max(5, 35 - Math.floor(reaction / 25));
    const score = reflexRun.score + earned;
    if (reflexRun.round === 5) {
      finishRun('reflex', score, `¡Ronda completa! Tu reacción más rápida merece aplausos.`);
    } else {
      setReflexRun({
        ...reflexRun,
        round: reflexRun.round + 1,
        score,
        phase: 'waiting',
        startedAt: null,
        message: `${reaction} ms · +${earned} XP. ¡Prepárate para la siguiente!`,
      });
    }
  };

  const moveMaze = useCallback((direction) => {
    if (!mazeRun || screen !== 'maze') return;
    const x = mazeRun.x + direction.x;
    const y = mazeRun.y + direction.y;
    const steps = mazeRun.steps + 1;
    if (x < 0 || y < 0 || x >= MAZE_SIZE || y >= MAZE_SIZE || MAZE_WALLS.has(`${x},${y}`)) {
      setMazeRun({ ...mazeRun, steps });
      return;
    }
    if (x === MAZE_SIZE - 1 && y === MAZE_SIZE - 1) {
      finishRun('maze', Math.max(15, 70 - steps * 2), `¡Encontraste la salida en ${steps} pasos!`);
      return;
    }
    setMazeRun({ x, y, steps });
  }, [mazeRun, screen, finishRun]);

  useEffect(() => {
    if (screen !== 'maze') return undefined;
    const directions = {
      ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
    };
    const onKeyDown = (event) => {
      if (directions[event.key]) {
        event.preventDefault();
        moveMaze(directions[event.key]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, moveMaze]);

  const nextEscapeRoom = () => {
    if (!escapeRun) return;
    if (escapeRun.index === ESCAPE_ROOMS.length - 1) {
      finishRun('escape', escapeRun.score, '¡Escapaste! Has completado las cinco salas.');
      return;
    }
    setEscapeRun({ ...escapeRun, index: escapeRun.index + 1, attempts: 0, hintOpen: false, feedback: null });
  };

  const renamePlayer = async () => {
    const result = await Swal.fire({
      title: 'Tu nombre de jugador',
      input: 'text',
      inputValue: profile.name,
      inputAttributes: { maxlength: '24', 'aria-label': 'Nombre de jugador' },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#6c5ce7',
      inputValidator: (value) => !value.trim() ? 'Escribe un nombre para tu perfil.' : undefined,
    });
    if (result.isConfirmed) setProfile((current) => ({ ...current, name: result.value.trim() }));
  };

  const showRules = () => {
    const gamesList = GAMES.map((game) =>
      `<div class="rules-row"><span>${game.icon}</span><span><strong>Nivel ${game.unlockLevel}</strong><small>${game.title}</small></span></div>`,
    ).join('');
    Swal.fire({
      title: '¡Bienvenido a MiniAventura!',
      html: `<div class="rules-content"><p>Juega, gana XP y abre los diez mundos.</p>${gamesList}<p class="rules-footer">Tus puntos, récords y partidas se guardan en este navegador. En los juegos de movimiento usa las flechas o WASD; en móvil, toca los controles en pantalla.</p></div>`,
      confirmButtonText: '¡Vamos!',
      confirmButtonColor: '#6c5ce7',
    });
  };

  const renderLobby = () => (
    <>
      <section className="arcade-hero">
        <div className="hero-copy">
          <p className="eyebrow">TU PRÓXIMA AVENTURA EMPIEZA AQUÍ</p>
          <h1>Un juego más.<br /><span>Un nivel más.</span></h1>
          <p>Pequeños retos, grandes victorias. Juega a tu ritmo y desbloquea nuevos mundos.</p>
          <button className="primary-button" type="button" onClick={() => startGame('snake')}>Jugar Culebrita <span>→</span></button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="hero-spark spark-one">✦</span>
          <span className="hero-spark spark-two">✧</span>
          <span className="hero-orbit">🐍</span>
          <span className="hero-star">⭐</span>
        </div>
      </section>

      <section className="arcade-summary">
        <article className="summary-card">
          <span className="summary-icon xp-icon">✦</span>
          <span><small>EXPERIENCIA TOTAL</small><strong>{profile.xp} <em>XP</em></strong></span>
        </article>
        <article className="summary-card">
          <span className="summary-icon level-icon">🏆</span>
          <span><small>NIVEL ACTUAL</small><strong>{levelInfo.level}</strong></span>
        </article>
        <article className="summary-card">
          <span className="summary-icon runs-icon">🎮</span>
          <span><small>PARTIDAS JUGADAS</small><strong>{totalRuns}</strong></span>
        </article>
      </section>

      <section className="level-progress-card">
        <div className="progress-heading">
          <div><p className="progress-title">Nivel {levelInfo.level} <span>→</span> Nivel {levelInfo.level + 1}</p><p className="progress-copy">Sigue jugando para abrir el siguiente desafío.</p></div>
          <strong>{levelInfo.progress} <span>/ {levelInfo.nextLevelCost} XP</span></strong>
        </div>
        <div className="progress-track" role="progressbar" aria-label="Progreso para el siguiente nivel" aria-valuenow={levelInfo.progress} aria-valuemin="0" aria-valuemax={levelInfo.nextLevelCost}>
          <div className="progress-fill" style={{ width: `${(levelInfo.progress / levelInfo.nextLevelCost) * 100}%` }} />
        </div>
      </section>

      <section className="games-section">
        <div className="section-heading"><div><p className="eyebrow">SELECCIONA TU MISIÓN</p><h2>Elige un minijuego</h2></div><span className="section-caption">10 juegos · nuevos retos al subir de nivel</span></div>
        <div className="game-grid">
          {GAMES.map((game) => {
            const locked = levelInfo.level < game.unlockLevel;
            const count = gameCounts[game.id] || 0;
            return (
              <article className={`game-card game-${game.color} ${locked ? 'game-locked' : ''}`} key={game.id}>
                <div className="game-card-top"><span className="game-emoji" aria-hidden="true">{game.icon}</span><span className={`game-state ${locked ? 'locked-state' : ''}`}>{locked ? `🔒 Nivel ${game.unlockLevel}` : count ? `✓ ${count} ${count === 1 ? 'partida' : 'partidas'}` : '● Disponible'}</span></div>
                <h3>{game.title}</h3><p>{game.subtitle}</p>
                <button className="game-play-button" type="button" disabled={locked} onClick={() => startGame(game.id)}>{locked ? `Desbloquea en nivel ${game.unlockLevel}` : 'Jugar ahora'} <span>{locked ? '🔒' : '→'}</span></button>
              </article>
            );
          })}
        </div>
      </section>
      {favoriteGame && <p className="favorite-nudge">🎖️ Tu favorito hasta ahora: <strong>{favoriteGame.title}</strong>. ¡A por un nuevo récord!</p>}
    </>
  );

  const renderProfile = () => (
    <section className="profile-page">
      <div className="profile-banner">
        <div className="avatar">🧑‍🚀</div>
        <div className="profile-identity"><p className="eyebrow">PERFIL DE JUGADOR</p><h1>{profile.name}</h1><p>Nivel {levelInfo.level} · Explorador de MiniAventura</p></div>
        <button className="secondary-button" type="button" onClick={renamePlayer}>Cambiar nombre</button>
      </div>
      <div className="profile-stat-grid">
        <article className="profile-stat"><small>EXPERIENCIA TOTAL</small><strong>{profile.xp} XP</strong></article>
        <article className="profile-stat"><small>PARTIDAS JUGADAS</small><strong>{totalRuns}</strong></article>
        <article className="profile-stat"><small>JUEGO FAVORITO</small><strong>{favoriteGame ? `${favoriteGame.icon} ${favoriteGame.title}` : 'Aún por descubrir'}</strong></article>
        <article className="profile-stat"><small>MÁS JUGADO</small><strong>{favoriteGame ? `${favoriteGame.icon} ${gameCounts[favoriteGame.id]} partidas` : 'Juega tu primera partida'}</strong></article>
      </div>
      <div className="profile-columns">
        <section className="panel profile-panel"><div className="panel-title"><span>🏆</span><div><h2>Récords personales</h2><p>Tu mejor puntuación en cada juego</p></div></div>
          <ul className="record-list">{highScores.map((game) => <li key={game.id}><span>{game.icon}</span><strong>{game.title}</strong><b>{game.best} <small>XP</small></b></li>)}</ul>
        </section>
        <section className="panel profile-panel"><div className="panel-title"><span>📈</span><div><h2>Tu aventura</h2><p>Estadísticas de tus partidas</p></div></div>
          <div className="adventure-stats"><div><strong>{new Set(profile.history.map((run) => run.gameId)).size}</strong><span>juegos probados</span></div><div><strong>{profile.history.length ? Math.max(...profile.history.map((run) => run.score)) : 0}</strong><span>mejor puntuación</span></div><div><strong>{profile.history.filter((run) => new Date(run.date).toDateString() === new Date().toDateString()).length}</strong><span>partidas hoy</span></div></div>
        </section>
      </div>
      {profile.history.length > 0 && <section className="panel recent-panel"><div className="panel-title"><span>🕹️</span><div><h2>Partidas recientes</h2><p>Tu actividad más reciente</p></div></div><ul className="recent-list">{profile.history.slice(0, 5).map((run) => { const game = GAMES.find((item) => item.id === run.gameId); return <li key={run.id}><span>{game?.icon || '🎮'} {game?.title || 'Minijuego'}</span><strong>+{run.score} XP</strong><small>{new Date(run.date).toLocaleDateString()}</small></li>; })}</ul></section>}
    </section>
  );

  const renderGameHeader = (title, subtitle) => (
    <div className="game-screen-heading">
      <button className="back-button" type="button" onClick={quitGame}>← Salir al menú</button>
      <div><p className="eyebrow">MINIAVENTURA · NIVEL {levelInfo.level}</p><h1>{title}</h1><p>{subtitle}</p></div>
    </div>
  );

  const renderSnake = () => {
    const bodyCells = new Set(snake.map((part) => `${part.x},${part.y}`));
    return <section className="active-game">
      {renderGameHeader('Culebrita', 'Come las manzanas y no choques contra los bordes ni contigo.')}
      <div className="game-hud"><div><small>PUNTUACIÓN</small><strong>{Math.max(0, (snake.length - 3) * 10)} <em>XP</em></strong></div><div><small>MANZANAS</small><strong>{snake.length - 3} 🍎</strong></div><button className="secondary-button" type="button" onClick={() => setSnakeStatus((status) => status === 'playing' ? 'paused' : 'playing')}>{snakeStatus === 'playing' ? 'Ⅱ Pausar' : '▶ Continuar'}</button></div>
      <div className={`snake-board ${snakeStatus !== 'playing' ? 'board-paused' : ''}`} role="grid" aria-label="Tablero de Culebrita">
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const x = index % BOARD_SIZE;
          const y = Math.floor(index / BOARD_SIZE);
          const key = `${x},${y}`;
          const snakeIndex = snake.findIndex((part) => part.x === x && part.y === y);
          const isFood = food.x === x && food.y === y;
          return <div className={`snake-cell ${snakeIndex === 0 ? 'snake-head' : snakeIndex > 0 ? 'snake-body' : ''} ${isFood ? 'food-cell' : ''}`} role="gridcell" key={key}>{isFood ? '🍎' : snakeIndex === 0 ? '●' : bodyCells.has(key) ? '' : ''}</div>;
        })}
        {snakeStatus === 'paused' && <div className="board-overlay"><span>⏸️</span><strong>Partida en pausa</strong><button className="primary-button" type="button" onClick={() => setSnakeStatus('playing')}>Continuar</button></div>}
        {snakeStatus === 'over' && <div className="board-overlay"><span>💥</span><strong>¡Fin de la partida!</strong><small>Tu puntuación se guardó.</small></div>}
      </div>
      <div className="snake-controls" aria-label="Controles de dirección"><button type="button" aria-label="Arriba" onClick={() => moveSnake({ x: 0, y: -1 })}>↑</button><div><button type="button" aria-label="Izquierda" onClick={() => moveSnake({ x: -1, y: 0 })}>←</button><button type="button" aria-label="Abajo" onClick={() => moveSnake({ x: 0, y: 1 })}>↓</button><button type="button" aria-label="Derecha" onClick={() => moveSnake({ x: 1, y: 0 })}>→</button></div></div>
      <p className="game-tip">Consejo: también puedes usar las flechas o W, A, S, D del teclado.</p>
    </section>;
  };

  const renderMath = () => {
    if (!mathRun) return null;
    const question = mathRun.questions[mathRun.index];
    return <section className="active-game">
      {renderGameHeader('Cálculo relámpago', 'Resuelve 10 operaciones. ¡Cada respuesta correcta aumenta tu racha!')}
      <div className="game-hud"><div><small>OPERACIÓN</small><strong>{mathRun.index + 1} <em>/ 10</em></strong></div><div><small>RACHA</small><strong>{mathRun.streak} 🔥</strong></div><div><small>PUNTOS DE ESTA PARTIDA</small><strong>{mathRun.score} XP</strong></div></div>
      <div className="math-challenge"><div className="question-progress"><span style={{ width: `${((mathRun.index + 1) / 10) * 100}%` }} /></div><p className="eyebrow">¿CUÁNTO ES?</p><h2>{question.expression} <span>= ?</span></h2>
        <div className="answer-grid">{question.choices.map((choice) => <button className="answer-button" type="button" key={`${mathRun.index}-${choice}`} disabled={Boolean(mathRun.feedback)} onClick={() => answerMath(choice)}>{choice}</button>)}</div>
        {mathRun.feedback && <div className={`answer-feedback ${mathRun.feedback.startsWith('¡') ? 'feedback-good' : 'feedback-try'}`} role="status">{mathRun.feedback}<button className="primary-button" type="button" onClick={nextMathQuestion}>{mathRun.index === 9 ? 'Ver resultado' : 'Siguiente →'}</button></div>}
      </div>
    </section>;
  };

  const renderEscape = () => {
    if (!escapeRun) return null;
    const room = ESCAPE_ROOMS[escapeRun.index];
    return <section className="active-game">
      {renderGameHeader('Escape: sala secreta', 'Cinco salas, cinco acertijos. Puedes pedir una pista cuando la necesites.')}
      <div className="game-hud"><div><small>SALA</small><strong>{escapeRun.index + 1} <em>/ 5</em></strong></div><div><small>LLAVES</small><strong>{escapeRun.index} 🗝️</strong></div><div><small>PUNTOS</small><strong>{escapeRun.score} XP</strong></div></div>
      <article className="escape-room"><div className="room-number">SALA {String(escapeRun.index + 1).padStart(2, '0')}</div><div className="room-door" aria-hidden="true">🚪</div><p className="eyebrow">{room.room}</p><h2>{room.story}</h2>
        {escapeRun.hintOpen && <p className="hint-box">💡 Pista: {room.hint}</p>}
        <div className="escape-options">{room.options.map((option) => <button className="answer-button" type="button" key={option} disabled={Boolean(escapeRun.feedback && escapeRun.feedback.startsWith('¡'))} onClick={() => answerEscape(option)}>{option}<span>→</span></button>)}</div>
        {escapeRun.feedback && <div className={`answer-feedback ${escapeRun.feedback.startsWith('¡') ? 'feedback-good' : 'feedback-try'}`} role="status">{escapeRun.feedback}{escapeRun.feedback.startsWith('¡') && <button className="primary-button" type="button" onClick={nextEscapeRoom}>{escapeRun.index === 4 ? 'Escapar →' : 'Siguiente sala →'}</button>}</div>}
        {!escapeRun.hintOpen && !escapeRun.feedback?.startsWith('¡') && <button className="hint-button" type="button" onClick={() => setEscapeRun({ ...escapeRun, hintOpen: true })}>💡 Necesito una pista</button>}
      </article>
    </section>;
  };

  const renderMemory = () => {
    if (!memoryRun) return null;
    return <section className="active-game">
      {renderGameHeader('Memoria cósmica', 'Encuentra las cuatro parejas ocultas. ¡Un movimiento es una pareja que volteas!')}
      <div className="game-hud"><div><small>PAREJAS</small><strong>{memoryRun.matched.length / 2} <em>/ 4</em></strong></div><div><small>MOVIMIENTOS</small><strong>{memoryRun.moves}</strong></div><div><small>XP EN ESTA PARTIDA</small><strong>{memoryRun.score} XP</strong></div></div>
      <div className="memory-board">
        {memoryRun.cards.map((card) => {
          const revealed = memoryRun.opened.includes(card.id) || memoryRun.matched.includes(card.id);
          return <button
            className={`memory-card ${revealed ? 'memory-revealed' : ''} ${memoryRun.matched.includes(card.id) ? 'memory-matched' : ''}`}
            type="button"
            key={card.id}
            aria-label={revealed ? `Carta ${card.symbol}` : 'Carta oculta'}
            onClick={() => flipMemoryCard(card.id)}
            disabled={memoryRun.locked || memoryRun.matched.includes(card.id) || memoryRun.opened.includes(card.id)}
          >{revealed ? card.symbol : '✦'}</button>;
        })}
      </div>
      <p className="game-tip">Cada pareja vale 15 XP. Encuéntralas en 8 movimientos o menos para ganar un bono de memoria perfecta.</p>
    </section>;
  };

  const renderNumber = () => {
    if (!numberRun) return null;
    return <section className="active-game">
      {renderGameHeader('Código secreto', 'Tengo un número del 1 al 50. Usa las pistas para descifrarlo en siete intentos.')}
      <div className="game-hud"><div><small>INTENTOS</small><strong>{numberRun.attempts} <em>/ 7</em></strong></div><div><small>RANGO</small><strong>1—50 🔢</strong></div><div><small>XP POSIBLES</small><strong>10—40</strong></div></div>
      <form className="number-challenge" onSubmit={guessNumber}>
        <span className="number-lock" aria-hidden="true">🔐</span>
        <p className="eyebrow">¿PUEDES DESCIFRAR EL CÓDIGO?</p>
        <label htmlFor="secret-guess">Elige un número entre 1 y 50</label>
        <div className="number-input-row"><input id="secret-guess" name="guess" type="number" min="1" max="50" placeholder="?" required autoFocus /><button className="primary-button" type="submit">Probar <span>→</span></button></div>
        <p className={`number-feedback ${numberRun.feedback.includes('MÁS') ? 'feedback-good' : ''}`} aria-live="polite">{numberRun.feedback || 'Cada pista te acercará a la respuesta.'}</p>
        <div className="guess-history" aria-label="Intentos anteriores">{numberRun.guesses.map((guess, index) => <span key={`${guess}-${index}`}>{guess} {guess < numberRun.target ? '↑' : guess > numberRun.target ? '↓' : '✓'}</span>)}</div>
      </form>
    </section>;
  };

  const renderSimon = () => {
    if (!simonRun) return null;
    return <section className="active-game">
      {renderGameHeader('Eco de colores', 'Observa la secuencia brillante y repítela en el mismo orden. Cada ronda suma un color.')}
      <div className="game-hud"><div><small>RONDA</small><strong>{simonRun.round} <em>/ 5</em></strong></div><div><small>SECUENCIA</small><strong>{simonRun.sequence.length} colores</strong></div><div><small>XP EN ESTA PARTIDA</small><strong>{simonRun.score} XP</strong></div></div>
      <div className="simon-challenge"><p className={`simon-message ${simonRun.phase === 'watch' ? 'watch-message' : ''}`} aria-live="polite">{simonRun.phase === 'watch' ? '👀 ¡Mira la secuencia!' : `👆 Tu turno · ${simonRun.input.length} de ${simonRun.sequence.length}`}</p>
        <div className="simon-pad">{SIMON_COLORS.map((color) => <button className={`simon-button simon-${color.id} ${simonHighlight === color.id ? 'simon-lit' : ''}`} type="button" key={color.id} aria-label={color.label} disabled={simonRun.phase !== 'input'} onClick={() => tapSimonColor(color.id)}>{color.emoji}</button>)}</div>
        <p className="game-tip">Las luces muestran el patrón; toca los colores para repetirlo. Cada secuencia superada suma 15 XP.</p>
      </div>
    </section>;
  };

  const renderTicTacToe = () => {
    if (!ticRun) return null;
    return <section className="active-game">
      {renderGameHeader('Gato galáctico', 'Haz tres en línea antes que el robot. ¡El centro del tablero es estratégico!')}
      <div className="game-hud"><div><small>TÚ</small><strong>❌ X</strong></div><div><small>ROBOT</small><strong>⭕ O</strong></div><div><small>TURNO</small><strong>{ticRun.turn === 'player' ? 'Tu turno' : 'Partida terminada'}</strong></div></div>
      <div className="tic-challenge"><p className="simon-message">{ticRun.turn === 'player' ? 'Tu turno: elige una casilla' : ticRun.result === 'win' ? '¡Ganaste el duelo! 🎉' : ticRun.result === 'draw' ? '¡Empate galáctico! 🤝' : ticRun.result === 'loss' ? 'El robot se llevó esta ronda 🤖' : ''}</p>
        <div className="tic-board" role="grid" aria-label="Tablero de gato">{ticRun.board.map((cell, index) => <button className={`tic-cell ${cell ? `tic-${cell.toLowerCase()}` : ''}`} type="button" role="gridcell" key={index} aria-label={`Casilla ${index + 1}${cell ? `: ${cell}` : ', vacía'}`} disabled={Boolean(cell) || ticRun.turn !== 'player'} onClick={() => playTicTacToe(index)}>{cell === 'X' ? '✕' : cell === 'O' ? '◯' : ''}</button>)}</div>
        <p className="game-tip">Victoria: 50 XP · empate: 25 XP · cada partida enseña una nueva estrategia.</p>
      </div>
    </section>;
  };

  const renderWord = () => {
    if (!wordRun) return null;
    return <section className="active-game">
      {renderGameHeader('Palabra revuelta', 'Las letras se han escapado de su lugar. Ordénalas y descifra la palabra.')}
      <div className="game-hud"><div><small>INTENTOS</small><strong>{wordRun.attempts} <em>/ 3</em></strong></div><div><small>LETRAS</small><strong>{wordRun.word.length} 🔤</strong></div><div><small>XP POSIBLES</small><strong>15—40</strong></div></div>
      <form className="word-challenge" onSubmit={submitWord}>
        <p className="eyebrow">PIENSA, ORDENA, ¡DESCUBRE!</p>
        <div className="scrambled-letters" aria-label={`Letras mezcladas: ${wordRun.letters.split('').join(', ')}`}>{wordRun.letters.split('').map((letter, index) => <span key={`${letter}-${index}`}>{letter}</span>)}</div>
        <label htmlFor="word-guess">¿Qué palabra forman?</label>
        <div className="number-input-row"><input id="word-guess" type="text" maxLength={wordRun.word.length} autoComplete="off" placeholder="Escribe tu respuesta" value={wordGuess} onChange={(event) => setWordGuess(event.target.value)} required /><button className="primary-button" type="submit">Comprobar <span>→</span></button></div>
        <p className="number-feedback" aria-live="polite">{wordRun.feedback || (wordRun.hintOpen ? `💡 Pista: ${wordRun.hint}` : 'Puedes usar una pista si te atascas.')}</p>
        {!wordRun.hintOpen && <button className="hint-button" type="button" onClick={() => setWordRun({ ...wordRun, hintOpen: true })}>💡 Mostrar pista</button>}
      </form>
    </section>;
  };

  const renderReflex = () => {
    if (!reflexRun) return null;
    return <section className="active-game">
      {renderGameHeader('¡Toque relámpago!', 'Completa cinco rondas. Espera la señal verde y toca lo más rápido que puedas.')}
      <div className="game-hud"><div><small>RONDA</small><strong>{reflexRun.round} <em>/ 5</em></strong></div><div><small>XP GANADOS</small><strong>{reflexRun.score}</strong></div><div><small>REGLA DE ORO</small><strong>¡No te adelantes!</strong></div></div>
      <div className={`reflex-challenge ${reflexRun.phase === 'go' ? 'reflex-go' : ''}`}>
        <span className="reflex-orb" aria-hidden="true">{reflexRun.phase === 'go' ? '⚡' : '⏳'}</span>
        <p className="reflex-message" aria-live="polite">{reflexRun.message}</p>
        <button className={`reflex-button ${reflexRun.phase === 'go' ? 'reflex-button-go' : ''}`} type="button" onClick={tapReflex}>{reflexRun.phase === 'go' ? '¡AHORA!' : 'Espera…'}</button>
        <p className="game-tip">Una reacción rápida puede valer hasta 35 XP por ronda. Tocar antes de tiempo no da puntos.</p>
      </div>
    </section>;
  };

  const renderMaze = () => {
    if (!mazeRun) return null;
    const mazeDirections = [
      { x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 },
    ];
    return <section className="active-game">
      {renderGameHeader('Laberinto brillante', 'Guía tu luciérnaga desde la entrada hasta la puerta. Cada movimiento cuenta.')}
      <div className="game-hud"><div><small>PASOS</small><strong>{mazeRun.steps}</strong></div><div><small>XP AL ESCAPAR</small><strong>{Math.max(15, 70 - mazeRun.steps * 2)}</strong></div><div><small>OBJETIVO</small><strong>Encuentra la 🚪</strong></div></div>
      <div className="maze-board" role="grid" aria-label="Laberinto de siete por siete">{Array.from({ length: MAZE_SIZE * MAZE_SIZE }, (_, index) => {
        const x = index % MAZE_SIZE;
        const y = Math.floor(index / MAZE_SIZE);
        const isWall = MAZE_WALLS.has(`${x},${y}`);
        const isPlayer = mazeRun.x === x && mazeRun.y === y;
        const isExit = x === MAZE_SIZE - 1 && y === MAZE_SIZE - 1;
        return <div className={`maze-cell ${isWall ? 'maze-wall' : ''} ${isPlayer ? 'maze-player' : ''} ${isExit ? 'maze-exit' : ''}`} role="gridcell" key={`${x},${y}`}>{isPlayer ? '✨' : isExit ? '🚪' : isWall ? '' : ''}</div>;
      })}</div>
      <div className="snake-controls" aria-label="Controles del laberinto"><button type="button" aria-label="Arriba" onClick={() => moveMaze(mazeDirections[0])}>↑</button><div><button type="button" aria-label="Izquierda" onClick={() => moveMaze(mazeDirections[1])}>←</button><button type="button" aria-label="Abajo" onClick={() => moveMaze(mazeDirections[2])}>↓</button><button type="button" aria-label="Derecha" onClick={() => moveMaze(mazeDirections[3])}>→</button></div></div>
      <p className="game-tip">Usa las flechas o WASD. Los muros bloquean el camino; busca los pasillos iluminados.</p>
    </section>;
  };

  const renderResult = () => (
    <section className="result-card"><span className="result-confetti" aria-hidden="true">🎉</span><p className="eyebrow">PARTIDA COMPLETADA</p><h1>¡Buen trabajo, {profile.name}!</h1><p>{lastResult?.message}</p><div className="result-score"><strong>+{lastResult?.score || 0}</strong><span>XP ganados en {lastResult?.title}</span></div><p className="result-total">Experiencia total: <strong>{profile.xp} XP</strong> · Nivel {levelInfo.level}</p><div className="result-actions"><button className="primary-button" type="button" onClick={() => startGame(lastResult.gameId)}>Jugar otra vez <span>↻</span></button><button className="secondary-button" type="button" onClick={() => setScreen('lobby')}>Volver a los juegos</button></div></section>
  );

  return (
    <main className="arcade-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => {
          if (screen !== 'lobby' && screen !== 'result') {
            quitGame();
            return;
          }
          setPage('games');
          setScreen('lobby');
        }} aria-label="Ir al menú principal"><span className="brand-icon">✦</span><span>mini<span className="brand-accent">aventura</span></span></button>
        {(screen === 'lobby' || screen === 'result') && <nav className="main-nav" aria-label="Navegación principal">
          <button className={page === 'games' ? 'nav-link nav-active' : 'nav-link'} type="button" onClick={() => { setPage('games'); setScreen('lobby'); }}>🎮 <span>Juegos</span></button>
          <button className={page === 'profile' ? 'nav-link nav-active' : 'nav-link'} type="button" onClick={() => { setPage('profile'); setScreen('lobby'); }}>👤 <span>Perfil</span></button>
        </nav>}
        <div className="header-player"><span className="header-avatar">🧑‍🚀</span><span className="header-player-info"><strong>{profile.name}</strong><small>Nivel {levelInfo.level}</small></span><button className="rules-button" type="button" onClick={showRules}>? <span>Ayuda</span></button></div>
      </header>
      {storageError && <p className="storage-warning" role="alert">No se pudo guardar el progreso en este navegador. Revisa la configuración de almacenamiento.</p>}
      {screen === 'result' ? renderResult()
        : page === 'profile' && screen === 'lobby' ? renderProfile()
          : screen === 'snake' ? renderSnake()
            : screen === 'math' ? renderMath()
              : screen === 'memory' ? renderMemory()
                : screen === 'number' ? renderNumber()
                  : screen === 'escape' ? renderEscape()
                    : screen === 'simon' ? renderSimon()
                      : screen === 'tictactoe' ? renderTicTacToe()
                        : screen === 'word' ? renderWord()
                          : screen === 'reflex' ? renderReflex()
                            : screen === 'maze' ? renderMaze()
                              : renderLobby()}
      <footer className="footer">Tu próxima aventura está a un clic <span aria-hidden="true">💜</span></footer>
    </main>
  );
}

export default App;
