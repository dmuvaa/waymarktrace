"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { historicalFigures, figureById } from "@/data/historical-figures";
import { matchAnswer } from "@/lib/game/answer-matching";
import {
  calculateRoundScore,
  createSession,
  difficultyDetails,
  getAccuracy,
} from "@/lib/game/engine";
import {
  getBestScores,
  loadPreferredDifficulty,
  loadSession,
  recordBestScore,
  savePreferredDifficulty,
  saveSession,
} from "@/lib/game/persistence";
import type {
  Difficulty,
  GameSession,
  Resolution,
  RoundResult,
} from "@/types/game";
import { hiddenHintText } from "@/lib/game/hints";
import type { RoundState } from "@/types/game";
import { SiteChrome, type SiteScreen } from "@/components/site/SiteChrome";
import { AnswerSheet } from "./AnswerSheet";
import { GameMap } from "./GameMap";

type Feedback = { tone: "neutral" | "error" | "success"; message: string } | null;

const difficultyOrder: Difficulty[] = ["easy", "medium", "hard", "super-hard"];
const validFigureIds = new Set(historicalFigures.map((figure) => figure.id));

export function WaymarktraceGame() {
  const [screen, setScreen] = useState<SiteScreen>("home");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [session, setSession] = useState<GameSession | null>(null);
  const [savedSession, setSavedSession] = useState<GameSession | null>(null);
  const [guess, setGuess] = useState("");
  const [regularHints, setRegularHints] = useState(0);
  const [hiddenHintUsed, setHiddenHintUsed] = useState(false);
  const [incorrectGuesses, setIncorrectGuesses] = useState(0);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [hydrated, setHydrated] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [sheetNudge, setSheetNudge] = useState(0);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setDifficulty(loadPreferredDifficulty());
      setSavedSession(loadSession(validFigureIds));
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const figure = useMemo(() => {
    if (!session) return null;
    return figureById.get(session.figureIds[session.roundIndex]) ?? null;
  }, [session]);

  const hintCount = regularHints + (hiddenHintUsed ? 1 : 0);

  const openScreen = (next: SiteScreen) => {
    setScreen(next);
    window.scrollTo({ top: 0 });
  };

  const rememberRound = (state: RoundState) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, roundState: state };
      saveSession(next);
      return next;
    });
  };

  const resetRound = () => {
    setGuess("");
    setRegularHints(0);
    setHiddenHintUsed(false);
    setIncorrectGuesses(0);
    setResolution(null);
    setFeedback(null);
    setSheetNudge(0);
  };

  const startGame = (selectedDifficulty = difficulty) => {
    const nextSession = createSession(selectedDifficulty, historicalFigures);
    setSession(nextSession);
    setDifficulty(selectedDifficulty);
    savePreferredDifficulty(selectedDifficulty);
    setStorageWarning(!saveSession(nextSession));
    setSavedSession(null);
    resetRound();
    setScreen("game");
    window.scrollTo({ top: 0 });
  };

  const resumeGame = () => {
    if (!savedSession) return;
    setSession(savedSession);
    setDifficulty(savedSession.difficulty);
    const savedResult = savedSession.results.at(-1);
    const currentFigureId = savedSession.figureIds[savedSession.roundIndex];
    if (savedResult?.figureId === currentFigureId) {
      setGuess("");
      setRegularHints(savedResult.hintsUsed);
      setHiddenHintUsed(false);
      setIncorrectGuesses(savedResult.incorrectGuesses);
      setResolution(savedResult.resolution);
      setFeedback({
        tone: savedResult.resolution === "correct" ? "success" : "neutral",
        message:
          savedResult.resolution === "correct"
            ? `Correct. You earned ${savedResult.score} points.`
            : savedResult.resolution === "skipped"
              ? "Round skipped. Here’s the answer."
              : "Answer revealed.",
      });
    } else if (savedSession.roundState?.figureId === currentFigureId) {
      setGuess("");
      setRegularHints(savedSession.roundState.regularHints);
      setHiddenHintUsed(savedSession.roundState.hiddenHintUsed);
      setIncorrectGuesses(savedSession.roundState.incorrectGuesses);
      setResolution(null);
      setFeedback(null);
    } else {
      resetRound();
    }
    setScreen("game");
    window.scrollTo({ top: 0 });
  };

  const resolveRound = (kind: Resolution) => {
    if (!session || !figure || resolution) return;
    const points = kind === "correct" ? calculateRoundScore(session.difficulty, hintCount) : 0;
    const result: RoundResult = {
      figureId: figure.id,
      resolution: kind,
      score: points,
      hintsUsed: hintCount,
      incorrectGuesses,
    };
    const nextStreak = kind === "correct" ? session.streak + 1 : 0;
    const updated: GameSession = {
      ...session,
      score: session.score + points,
      streak: nextStreak,
      bestStreak: Math.max(session.bestStreak, nextStreak),
      results: [...session.results, result],
      roundState: undefined,
    };
    setSession(updated);
    setResolution(kind);
    saveSession(updated);
    setFeedback(
      kind === "correct"
        ? { tone: "success", message: `Correct. You earned ${points} points.` }
        : {
            tone: "neutral",
            message: kind === "skipped" ? "Round skipped. Here’s the answer." : "Answer revealed.",
          },
    );
  };

  const submitGuess = (event: FormEvent) => {
    event.preventDefault();
    if (!session || !figure || resolution) return;
    if (!guess.trim()) {
      setFeedback({ tone: "error", message: "Enter a name before guessing." });
      return;
    }

    const result = matchAnswer(guess, figure, historicalFigures);
    if (result.status === "correct") {
      resolveRound("correct");
      if (result.fuzzy) {
        setFeedback({
          tone: "success",
          message: `Correct — we recognized “${guess.trim()}”.`,
        });
      }
      return;
    }
    if (result.status === "ambiguous") {
      setFeedback({
        tone: "error",
        message: "That name could refer to more than one historical figure. Try a fuller name.",
      });
      return;
    }
    const nextIncorrect = incorrectGuesses + 1;
    setIncorrectGuesses(nextIncorrect);
    rememberRound({
      figureId: figure.id,
      regularHints,
      hiddenHintUsed,
      incorrectGuesses: nextIncorrect,
    });
    setFeedback({ tone: "error", message: "Not quite. Try another name." });
  };

  const showNextHint = () => {
    if (!figure || resolution || regularHints >= 3) return;
    const nextHints = regularHints + 1;
    setRegularHints(nextHints);
    rememberRound({
      figureId: figure.id,
      regularHints: nextHints,
      hiddenHintUsed,
      incorrectGuesses,
    });
    setFeedback(null);
    setSheetNudge((value) => value + 1);
  };

  const showHiddenHint = () => {
    if (!figure || resolution || hiddenHintUsed) return;
    setHiddenHintUsed(true);
    rememberRound({
      figureId: figure.id,
      regularHints,
      hiddenHintUsed: true,
      incorrectGuesses,
    });
    setFeedback(null);
    setSheetNudge((value) => value + 1);
  };

  const nextRound = () => {
    if (!session || !resolution) return;
    const isFinal = session.roundIndex === session.figureIds.length - 1;
    if (isFinal) {
      recordBestScore(session.difficulty, session.score);
      saveSession(null);
      setScreen("results");
      window.scrollTo({ top: 0 });
      return;
    }
    const updated = { ...session, roundIndex: session.roundIndex + 1, roundState: undefined };
    window.scrollTo({ top: 0 });
    setSession(updated);
    saveSession(updated);
    resetRound();
  };

  const frame = (content: ReactNode) => (
    <SiteChrome
      current={screen}
      onHome={() => openScreen("home")}
      onGuide={() => openScreen("guide")}
      onPlay={() => openScreen(session && screen !== "results" ? "game" : "home")}
    >
      {content}
    </SiteChrome>
  );

  if (!hydrated) return <main className="boot-screen">waymarktrace</main>;

  if (screen === "guide") {
    return frame(
      <main className="guide-screen">
        <section className="guide">
          <p className="kicker">How it works</p>
          <h1>Trace the historical figure on the map.</h1>
          <div className="guide-steps">
            <article>
              <h2>Read the two markers</h2>
              <p>The green circle is the birth place and year. The red circle is the death place and year. The historical figure stays hidden.</p>
            </article>
            <article>
              <h2>Use the map</h2>
              <p>Pan and zoom to inspect coastlines, islands, and distances. Reframe clues returns to the opening view. Easy asks about well-known figures and shows borders and labels. Medium asks about familiar figures and removes the labels. Hard asks about lesser-known figures and removes borders. Super hard asks about obscure figures and leaves the bare land and water.</p>
            </article>
            <article>
              <h2>Name the figure</h2>
              <p>Small spelling differences still count. A wrong guess lets you try again. Hint icons sit at the top right of the map, beside the zoom controls. Each ordinary hint lowers the round score by 20%, up to 60%. The hidden hint can be opened once for that figure.</p>
            </article>
          </div>
          <button className="primary-action guide-play" type="button" onClick={() => openScreen("home")}>
            Choose a difficulty
          </button>
        </section>
      </main>,
    );
  }

  if (screen === "home") {
    const scores = getBestScores();
    return frame(
      <main className="home-screen">
        <section className="home-hero">
          <div className="hero-copy">
            <p className="kicker">Birth place. Death place. Two years.</p>
            <h1>Read the map.<br />Name the historical figure.</h1>
            <p className="hero-intro">
              Trace the historical figure given their birth and death places, alongside the respective years.
            </p>
            <div className="clue-key" aria-label="Map clue key">
              <span><i className="key-ring key-ring--birth" />Birth place + year</span>
              <span><i className="key-ring key-ring--death" />Death place + year</span>
            </div>
          </div>

          <div className="start-panel">
            <h2>Choose a difficulty</h2>
            <div className="difficulty-list" role="radiogroup" aria-label="Difficulty">
              {difficultyOrder.map((level) => {
                const item = difficultyDetails[level];
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={difficulty === level}
                    className={`difficulty-option${difficulty === level ? " is-selected" : ""}`}
                    onClick={() => setDifficulty(level)}
                  >
                    <span className="difficulty-radio" />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <b>{item.multiplier}×</b>
                  </button>
                );
              })}
            </div>
            <button className="primary-action" type="button" onClick={() => startGame()}>
              Start a 10-round game
            </button>
            {savedSession && (
              <button className="text-action resume-action" type="button" onClick={resumeGame}>
                Resume round {savedSession.roundIndex + 1} · {difficultyDetails[savedSession.difficulty].label}
              </button>
            )}
            <p className="best-score">
              Best on {difficultyDetails[difficulty].label}: <strong>{scores[difficulty]}</strong>
            </p>
          </div>
        </section>
      </main>,
    );
  }

  if (!session || !figure) return frame(<main className="boot-screen">Choose a game from Play.</main>);

  if (screen === "results") {
    const correct = session.results.filter((result) => result.resolution === "correct").length;
    return frame(
      <main className="results-screen">
        <section className="results-card">
          <p className="kicker">Expedition complete</p>
          <h1>{session.score} points</h1>
          <p className="results-lede">
            You identified {correct} of {session.results.length} historical figures on{" "}
            {difficultyDetails[session.difficulty].label}.
          </p>
          <div className="results-stats">
            <div><strong>{getAccuracy(session)}%</strong><span>Accuracy</span></div>
            <div><strong>{session.bestStreak}</strong><span>Best streak</span></div>
            <div><strong>{session.results.reduce((sum, item) => sum + item.incorrectGuesses, 0)}</strong><span>Wrong guesses</span></div>
          </div>
          <div className="journey-list">
            {session.results.map((result) => {
              const item = figureById.get(result.figureId);
              return item ? (
                <div key={result.figureId}>
                  <span className={`result-mark result-mark--${result.resolution}`} />
                  <span><strong>{item.name}</strong><small>{item.birthLocation.name} → {item.deathLocation.name}</small></span>
                  <b>{result.score}</b>
                </div>
              ) : null;
            })}
          </div>
          <div className="results-actions">
            <button className="primary-action" type="button" onClick={() => startGame(session.difficulty)}>Play again</button>
            <button className="secondary-action" type="button" onClick={() => openScreen("home")}>Home</button>
          </div>
        </section>
      </main>,
    );
  }

  const currentHints = [figure.hints.category, figure.hints.century, figure.hints.clue].slice(0, regularHints);

  return frame(
    <main className="game-screen">
      <header className="game-header">
        <div className="round-progress">
          <span>Round {session.roundIndex + 1} of {session.figureIds.length}</span>
          <div><i style={{ width: `${((session.roundIndex + 1) / session.figureIds.length) * 100}%` }} /></div>
        </div>
        <div className="game-stats">
          <span><small>Score</small><strong>{session.score}</strong></span>
          <span><small>Streak</small><strong>{session.streak}</strong></span>
          <span className="difficulty-chip">{difficultyDetails[session.difficulty].label} · {difficultyDetails[session.difficulty].multiplier}×</span>
        </div>
      </header>

      {storageWarning && (
        <div className="storage-warning" role="status">Progress cannot be saved in this browser, but you can keep playing.</div>
      )}

      <section className="play-layout">
        <div className="map-column">
          <GameMap
            figure={figure}
            difficulty={session.difficulty}
            resolved={Boolean(resolution)}
            hintsDisabled={regularHints >= 3}
            hiddenHintDisabled={hiddenHintUsed}
            onHint={showNextHint}
            onHiddenHint={showHiddenHint}
          />
        </div>

        <AnswerSheet key={figure.id} openToken={(resolution ? 1 : 0) + sheetNudge}>
          {!resolution ? (
            <>
              <div className="question-heading">
                <p>Birth and death places</p>
                <h1>Who is this Historical Figure?</h1>
                <span>Use the locations and dates on the map.</span>
              </div>

              <form onSubmit={submitGuess} className="guess-form">
                <label htmlFor="guess">Historical figure</label>
                <input
                  id="guess"
                  value={guess}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (feedback?.tone === "error" && value.length < guess.length) setFeedback(null);
                    setGuess(value);
                  }}
                  placeholder="Type a name"
                  autoComplete="off"
                  autoCorrect="off"
                />
                {feedback && (
                  <p className={`feedback feedback--${feedback.tone}`} role="status" aria-live="polite">
                    {feedback.message}
                  </p>
                )}
                <button className="primary-action sheet-anchor" type="submit">Submit Guess</button>
              </form>

              {(hiddenHintUsed || currentHints.length > 0) && (
                <div className="hints" aria-label="Revealed hints">
                  {hiddenHintUsed && <p><b>Hidden hint</b>{hiddenHintText(figure.name)}</p>}
                  {currentHints.map((hint, index) => <p key={hint}><b>Hint {index + 1}</b>{hint}</p>)}
                </div>
              )}

              <div className="round-tools">
                <button type="button" onClick={() => resolveRound("skipped")}>Skip round</button>
              </div>
              <button className="reveal-action" type="button" onClick={() => resolveRound("revealed")}>
                Reveal answer
              </button>
            </>
          ) : (
            <div className="reveal-panel">
              <p className={`resolution-label resolution-label--${resolution}`}>
                {resolution === "correct" ? "Identified" : resolution === "skipped" ? "Skipped" : "Revealed"}
              </p>
              <h1>{figure.name}</h1>
              <p className="life-dates">{figure.birthYear < 0 ? `${Math.abs(figure.birthYear)} BCE` : figure.birthYear} – {figure.deathYear < 0 ? `${Math.abs(figure.deathYear)} BCE` : figure.deathYear}</p>
              <p className="biography">{figure.biography}</p>
              <dl className="place-details">
                <div><dt>Born</dt><dd>{figure.birthLocation.name}</dd></div>
                <div><dt>Died</dt><dd>{figure.deathLocation.name}</dd></div>
              </dl>
              {feedback && <p className={`feedback feedback--${feedback.tone}`} role="status">{feedback.message}</p>}
              <button className="primary-action sheet-anchor" type="button" onClick={nextRound}>
                {session.roundIndex === session.figureIds.length - 1 ? "See results" : "Next figure"}
              </button>
            </div>
          )}
        </AnswerSheet>
      </section>
    </main>,
  );
}
