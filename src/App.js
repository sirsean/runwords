import React from 'react';
import { Provider, useSelector } from 'react-redux';
import { createSlice, configureStore } from '@reduxjs/toolkit';
import fiveLetterDictionary from './words_five.js';
import wordleDictionary from './wordle_dictionary.js';
import sequence from './sequence.js';
import './App.css';

const allWords = new Set(fiveLetterDictionary.map(w => w.toUpperCase()));
const wordleWords = wordleDictionary.map(w => w.toUpperCase());
const alphaSet = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));

function range(n) {
    return [...Array(n).keys()];
}

function todayGameIndex() {
    return parseInt((new Date()).getTime() / 86400000) - 19057;
}

function currentHistory({ numCorrect, guessesRemaining, guesses, hits, gameWon, gameLost }) {
    return { numCorrect, guessesRemaining, guesses, hits, gameWon, gameLost };
}

const persistedHistory = localStorage.getItem('runwords') ? JSON.parse(localStorage.getItem('runwords')) : [];

const gameSlice = createSlice({
    name: 'game',
    initialState: {
        gameIndex: null,
        sequence: null,
        numCorrect: null,
        guessesRemaining: null,
        targetWord: null,
        hits: null,
        guesses: null,
        currentGuess: null,
        history: persistedHistory,
    },
    reducers: {
        newGame: (state, action) => {
            const gameIndex = action.payload.gameIndex;
            state.gameIndex = gameIndex;
            state.sequence = sequence({
                seed: gameIndex * 10,
                size: 10,
                max: wordleWords.length,
            }).map(i => wordleWords[i]);
            state.numCorrect = 0;
            state.guessesRemaining = 6;
            state.hits = [];
            state.guesses = [[]];
            state.currentGuess = '';
            state.gameWon = false;
            state.gameLost = false;
            if (state.history.length > gameIndex) {
                const current = state.history[gameIndex];
                if (current) {
                    state.numCorrect = current.numCorrect;
                    state.guessesRemaining = current.guessesRemaining;
                    state.guesses = current.guesses;
                    state.hits = current.hits;
                    state.gameWon = current.gameWon;
                    state.gameLost = current.gameLost;
                }
            }
            state.targetWord = state.sequence[state.numCorrect];
        },
        handleKey: (state, action) => {
            if (state.gameWon || state.gameLost) {
                return;
            }
            state.wrongGuess = false;
            const letter = action.payload.key;
            if (alphaSet.has(letter) && state.currentGuess.length < 5) {
                state.currentGuess += letter;
            } else if ((letter === 'BACKSPACE') || (letter === 'DELETE')) {
                state.currentGuess = state.currentGuess.slice(0, -1);
            } else if (letter === 'ENTER') {
                if (allWords.has(state.currentGuess)) {
                    state.guesses[state.numCorrect].push(state.currentGuess);
                    for (let i=0; i < 5; i++) {
                        if (state.targetWord[i] === state.currentGuess[i]) {
                            state.hits.push(state.currentGuess[i]);
                        }
                    }
                    if (state.currentGuess === state.targetWord) {
                        state.numCorrect++;
                        if (state.numCorrect === state.sequence.length) {
                            state.gameWon = true;
                        } else {
                            state.guessesRemaining = state.guessesRemaining - state.guesses[state.numCorrect-1].length + 3;
                            state.guesses.push([state.currentGuess]);
                            state.targetWord = state.sequence[state.numCorrect];
                            state.hits = [];
                            for (let i=0; i < 5; i++) {
                                if (state.targetWord[i] === state.currentGuess[i]) {
                                    state.hits.push(state.currentGuess[i]);
                                }
                            }
                        }
                    } else if (state.guesses[state.numCorrect].length === state.guessesRemaining) {
                        state.gameLost = true;
                    }
                    if (state.gameWon || state.gameLost) {
                        state.history[state.gameIndex] = currentHistory(state);
                    }
                    state.currentGuess = '';
                } else {
                    state.wrongGuess = true;
                }
            }
        },
    },
});

const { newGame, handleKey } = gameSlice.actions;
const store = configureStore({
    reducer: gameSlice.reducer,
});

const selectGameIndex = state => state.gameIndex;
const selectSequence = state => state.sequence;
const selectNumCorrect = state => state.numCorrect;
const selectCorrectGuesses = (state) => {
    const numCorrect = state.numCorrect;
    const sequence = state.sequence;
    return sequence.slice(0, numCorrect);
}
const selectGuessesRemaining = state => state.guessesRemaining;
const selectTargetWord = state => state.targetWord;
const selectGuesses = state => state.guesses[state.numCorrect];
const selectAllGuesses = state => state.guesses;
const selectCurrentGuess = state => state.currentGuess;
const selectWrongGuess = state => state.wrongGuess;
const selectGameOver = state => {
    return state.gameWon || state.gameLost;
};
const selectHistory = state => state.history;

function calculateCharacterHitPartialMiss(targetWord, guess) {
    const targetLetters = new Set(targetWord.split(''));
    let results = [];
    for (let i=0; i < targetWord.length; i++) {
        if (targetWord[i] === guess[i]) {
            results.push('hit');
        } else if (targetLetters.has(guess[i])) {
            results.push('partial');
        } else {
            results.push('miss');
        }
    }
    return results;
}

const selectIsHit = letter => state => {
    const hits = new Set(state.hits);
    return hits.has(letter);
};

const selectIsPartial = letter => state => {
    const hits = new Set(state.hits);
    const guessed = new Set(state.guesses[state.numCorrect].join('').split(''));
    const target = new Set(state.targetWord.split(''));
    return !hits.has(letter) && guessed.has(letter) && target.has(letter);
};

const selectIsPartialIndex = (letter, index) => state => {
    const target = new Set(state.targetWord);
    return target.has(letter) && target[index] !== letter;
}

const selectIsMiss = letter => state => {
    const hits = new Set(state.hits);
    const guessed = new Set(state.guesses[state.numCorrect].join('').split(''));
    const target = new Set(state.targetWord.split(''));
    return !hits.has(letter) && guessed.has(letter) && !target.has(letter);
};

store.subscribe(() => {
    const state = store.getState();
    let history = state.history.slice();
    history[state.gameIndex] = currentHistory(state);
    localStorage.setItem('runwords', JSON.stringify(history));
});

function Block({ rowIndex, blockIndex }) {
    const target = useSelector(selectTargetWord);
    const guesses = useSelector(selectGuesses);
    const currentGuess = useSelector(selectCurrentGuess);
    const wrongGuess = useSelector(selectWrongGuess);
    let letter = '';
    if (rowIndex < guesses.length) {
        letter = guesses[rowIndex][blockIndex];
    }
    const isHit = (target[blockIndex] === letter);
    const isPartial = useSelector(selectIsPartialIndex(letter, blockIndex));
    let currentGuessRow = false;
    if ((rowIndex === guesses.length) && (blockIndex < currentGuess.length)) {
        currentGuessRow = true;
        letter = currentGuess[blockIndex];
    }
    let className = 'block';
    if (currentGuessRow && wrongGuess) {
        className += ' wrong';
    } else if (isHit) {
        className += ' hit';
    } else if (isPartial) {
        className += ' partial';
    } else if ((letter !== '') && (rowIndex < guesses.length)) {
        className += ' miss';
    }
    return (
        <div className={className}>{letter}</div>
    );
}

function Row({ rowIndex }) {
    return (
        <div className="row">
        {range(5).map(i => <Block key={i} rowIndex={rowIndex} blockIndex={i} />)}
        </div>
    );
}

function Grid() {
    const gameOver = useSelector(selectGameOver);
    const guessesRemaining = useSelector(selectGuessesRemaining);
    if (gameOver) {
        return null;
    } else {
        return (
            <div className="grid">
            {range(guessesRemaining).map(i => <Row key={i} rowIndex={i} />)}
            </div>
        );
    }
}

function KeyboardKey({ letter }) {
    const isHit = useSelector(selectIsHit(letter));
    const isPartial = useSelector(selectIsPartial(letter));
    const isMiss = useSelector(selectIsMiss(letter));
    let className = 'keyboardKey';
    if (isHit) {
        className += ' hit';
    } else if (isPartial) {
        className += ' partial';
    } else if (isMiss) {
        className += ' miss';
    }
    const handle = () => {
        store.dispatch(handleKey({ key: letter }));
    };
    return (
        <div className={className} onClick={handle}>
            {letter}
        </div>
    );
}

function KeyboardRow({ letters }) {
    return (
        <div className="keyboardRow">
            {letters.split('').map(letter => <KeyboardKey key={letter} letter={letter} />)}
        </div>
    );
}

function KeyboardControlRow() {
    const handleDelete = () => {
        store.dispatch(handleKey({ key: 'BACKSPACE' }));
    };
    const handleEnter = () => {
        store.dispatch(handleKey({ key: 'ENTER' }));
    };
    return (
        <div className="keyboardRow controlRow">
            <div className="keyboardKey controlKey" onClick={handleDelete}>DEL</div>
            <div className="keyboardKey controlKey" onClick={handleEnter}>ENTER</div>
        </div>
    );
}

function Keyboard() {
    const gameOver = useSelector(selectGameOver);
    const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    const handleKeyUp = (e) => {
        store.dispatch(handleKey({ key: e.key.toUpperCase() }));
    }
    React.useEffect(() => {
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);
    if (gameOver) {
        return null;
    } else {
        return (
            <div className="keyboard">
            {rows.map(letters => <KeyboardRow key={letters} letters={letters} />)}
            <KeyboardControlRow />
            </div>
        );
    }
}
function Title() {
    const gameIndex = useSelector(selectGameIndex);
    return (
        <code>\\execute &lt;runwords[{gameIndex}]&gt;</code>
    );
}

function CorrectGuesses() {
    const correctGuesses = useSelector(selectCorrectGuesses);
    const allGuesses = useSelector(selectAllGuesses);
    const numCorrect = useSelector(selectNumCorrect);
    const gameOver = useSelector(selectGameOver);
    const sequence = useSelector(selectSequence);
    return (
        <div className="CorrectGuesses">
        {gameOver &&
            allGuesses.map((guesses, i) => {
                return guesses.map((word, j) => {
                    const classes = calculateCharacterHitPartialMiss(sequence[i], word);
                    const last = ((j === guesses.length -1) && (i < numCorrect));
                    return (
                        <code key={[i,j]}>
                        {last && <span>{i+1}&gt;&nbsp;{(numCorrect === 10) && (i < 9) && <span>&nbsp;</span>}</span>}
                        {!last && <span>&nbsp;&nbsp;&nbsp;{(numCorrect === 10) && <span>&nbsp;</span>}</span>}
                        {word.split('').map((c, k) => {
                            return <span key={[i,j,k]} className={classes[k]}>{c}</span>
                        })}
                        </code>
                    );
                });
            })}
        {!gameOver && correctGuesses.map((word, i) => {
            return <code key={i}>{i+1}&gt;&nbsp;{((numCorrect >= 10) && ((i+1) < 10)) && <span>&nbsp;</span>}<span className="hit">{word}</span>[{allGuesses[i].length}]</code>
        })}
        {(gameOver && (numCorrect < 10)) && <code className="incorrect">{numCorrect+1}&gt; {sequence[numCorrect]}</code>}
        </div>
    );
}

function GameOver() {
    const gameOver = useSelector(selectGameOver);
    const numCorrect = useSelector(selectNumCorrect);
    if (gameOver) {
        return (
            <div className="GameOver">
            {(numCorrect === 0) && <code>..fail..</code>}
            {((0 < numCorrect) && (numCorrect < 3)) && <code>..good run..</code>}
            {((3 <= numCorrect) && (numCorrect < 7)) && <code>..great run!..</code>}
            {((7 <= numCorrect) && (numCorrect < 10)) && <code>..you are amazing!..</code>}
            {(numCorrect === 10) && <code>!..YOU WIN..!</code>}
            </div>
        );
    } else {
        return null;
    }
}

function HistoryRow({ gameIndex, game }) {
    const onClick = () => {
        store.dispatch(newGame({ gameIndex: gameIndex }));
    };
    return (
        <div className="historyRow" onClick={onClick}>
            <code>{gameIndex}</code>
        {(!game || !(game.gameWon || game.gameLost)) &&
            <code className="unplayed">click here to play</code>}
        {game && (game.gameWon || game.gameLost) &&
                <code>{range(game.numCorrect).map(n => {
                    return <span key={n}>.</span>
                })} {game.numCorrect}</code>}
        </div>
    );
}

function History() {
    const gameOver = useSelector(selectGameOver);
    const maxIndex = todayGameIndex();
    const history = useSelector(selectHistory);
    if (gameOver) {
        return (
            <div className="history">
            <code>$ ls h1st0ry/</code>
            {range(maxIndex+1).reverse().map(index => <HistoryRow key={index} gameIndex={index} game={history[index]} />)}
            </div>
        );
    } else {
        return null;
    }
}

function App() {
    store.dispatch(newGame({ gameIndex: todayGameIndex() }));
    return (
        <Provider store={store}>
            <div className="App">
                <Title />
                <CorrectGuesses />
                <Grid />
                <Keyboard />
                <GameOver />
                <History />
            </div>
        </Provider>
    );
}

export default App;
