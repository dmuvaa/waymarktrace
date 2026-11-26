"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import type { HistoricalFigure } from "@/types/game";
import { matchAnswer } from "@/lib/game/answer-matching";
import { eraDetails, fieldDetails, worldRegionDetails } from "@/lib/game/classify";
import {
  calculateRoundScore,
  createSession,
  defaultSetup,
  difficultyDetails,
  difficultyOrder,
  eligiblePool,
  getAccuracy,
  isStandardGame,
  matchesTheme,
  ROUND_OPTIONS,
  shuffle,
} from "@/lib/game/engine";
import {
  clearSeen,
  getBestScores,
  loadSeen,
  loadSession,
  loadSetup,
  markSeen,
  recordBestScore,
  saveSession,
  saveSetup,
} from "@/lib/game/persistence";
import type {
  Era,
  Field,
  GameSession,
  GameSetup,
  Resolution,
  RoundResult,
  WorldRegion,
} from "@/types/game";
import { hiddenHintText } from "@/lib/game/hints";
import type { RoundState } from "@/types/game";
import { SiteChrome, type SiteScreen } from "@/components/site/SiteChrome";
import { AnswerSheet } from "./AnswerSheet";
import { GameMap } from "./GameMap";

type Feedback = { tone: "neutral" | "error" | "success"; message: string } | null;

type Dataset = {
  figures: HistoricalFigure[];
  byId: Map<string, HistoricalFigure>;
  validIds: Set<string>;
};

const eraOrder = Object.keys(eraDetails) as Era[];
const fieldOrder = Object.keys(fieldDetails) as Field[];
const regionOrder = Object.keys(worldRegionDetails) as WorldRegion[];

function displayYear(year: number) {
  return year < 0 ? `${Math.abs(year)} BCE` : `${year}`;
}

function themeLabel(setup: GameSetup) {
  const parts = [
    setup.era !== "any" && eraDetails[setup.era].label,
    setup.field !== "any" && fieldDetails[setup.field].label,
    setup.region !== "any" && worldRegionDetails[setup.region].label,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "All of history";
}

export function WaymarktraceGame() {
  const [screen, setScreen] = useState<SiteScreen>("home");
  const [data, setData] = useState<Dataset | null>(null);
  const [setup, setSetup] = useState<GameSetup>(defaultSetup);
  const [seen, setSeen] = useState<Map<string, number>>(new Map());
  const [newBest, setNewBest] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
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
    // The dataset (~4,000 figures) is its own chunk so the page shell paints first.
    import("@/data/historical-figures").then(({ historicalFigures, figureById }) => {
      if (!active) return;
      const validIds = new Set(historicalFigures.map((item) => item.id));
      setData({ figures: historicalFigures, byId: figureById, validIds });
      setSetup(loadSetup());
      setSeen(loadSeen());
      setSavedSession(loadSession(validIds));
      setHydrated(true);
    }).catch((error: unknown) => {
      console.error("Could not load the historical figures", error);
      if (active) setLoadFailed(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const figure = useMemo(() => {
    if (!session || !data) return null;
    return data.byId.get(session.figureIds[session.roundIndex]) ?? null;
  }, [session, data]);

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

  const updateSetup = (patch: Partial<GameSetup>) => {
    setSetup((current) => {
      const next = { ...current, ...patch };
      saveSetup(next);
      return next;
    });
  };

  const startGame = (chosen = setup) => {
    if (!data) return;
    const latestSeen = loadSeen();
    setSeen(latestSeen);
    const nextSession = createSession(chosen, data.figures, latestSeen);
    if (!nextSession.figureIds.length) return;
    setSession(nextSession);
    setSetup(chosen);
    saveSetup(chosen);
    setNewBest(false);
    setStorageWarning(!saveSession(nextSession));
    setSavedSession(null);
    resetRound();
    setScreen("game");
    window.scrollTo({ top: 0 });
  };

  const resumeGame = () => {
    if (!savedSession) return;
    setSession(savedSession);
    setSetup(savedSession.setup);
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
    const points = kind === "correct" ? calculateRoundScore(figure.recognition, hintCount) : 0;
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
    markSeen(figure.id);
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

    const result = matchAnswer(guess, figure, data?.figures ?? [figure]);
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
      setNewBest(isStandardGame(session.setup) && recordBestScore(session.setup.difficulty, session.score));
      setSeen(loadSeen());
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

  if (loadFailed) {
    return (
      <main className="boot-screen">
        <p>The figures could not be loaded.</p>
        <button className="text-action" type="button" onClick={() => window.location.reload()}>Try again</button>
      </main>
    );
  }
  if (!hydrated || !data) return <main className="boot-screen">waymarktrace</main>;

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
              <h2>Pick your game</h2>
              <p>Easy asks about household names and shows borders and labels. Medium removes the labels, Hard removes borders, and Super hard leaves bare land and water. Narrow any game to an era, a field, or a part of the world, or let Surprise me pick a theme. Figures you have already met are held back until you have seen the rest of the pool.</p>
            </article>
            <article>
              <h2>Name the figure</h2>
              <p>Small spelling differences still count. A wrong guess lets you try again. Hints sit at the top right of the map: what they did, where they belonged, then a closer clue. Each lowers the round score by 20%, up to 60%. The hidden hint gives the first letter.</p>
            </article>
          </div>
          <button className="primary-action guide-play" type="button" onClick={() => openScreen("home")}>
            Set up a game
          </button>
        </section>
      </main>,
    );
  }

  if (screen === "home") {
    const scores = getBestScores();
    const themed = data.figures.filter((item) => matchesTheme(item, setup));
    const pool = eligiblePool(data.figures, setup);
    const fresh = pool.filter((item) => !seen.has(item.id)).length;
    const rounds = Math.min(setup.rounds, pool.length);
    const themeCount = (patch: Partial<GameSetup>) =>
      data.figures.filter((item) => matchesTheme(item, { ...setup, ...patch })).length;

    const surprise = () => {
      // A random era, field or region (sometimes two) with enough figures for the game.
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const dimensions = shuffle(["era", "field", "region"] as const).slice(0, Math.random() < 0.35 ? 2 : 1);
        const patch: Partial<GameSetup> = { era: "any", field: "any", region: "any" };
        for (const dimension of dimensions) {
          if (dimension === "era") patch.era = shuffle(eraOrder)[0];
          if (dimension === "field") patch.field = shuffle(fieldOrder)[0];
          if (dimension === "region") patch.region = shuffle(regionOrder)[0];
        }
        const candidate = { ...setup, ...patch };
        const sameAsNow =
          candidate.era === setup.era && candidate.field === setup.field && candidate.region === setup.region;
        if (!sameAsNow && eligiblePool(data.figures, candidate).length >= setup.rounds * 2) {
          updateSetup(patch);
          return;
        }
      }
    };

    return frame(
      <main className="home-screen">
        <section className="home-hero">
          <div className="hero-copy">
            <p className="kicker">Birth place. Death place. Two years.</p>
            <h1>Read the map.<br />Name the historical figure.</h1>
            <p className="hero-intro">
              Trace the historical figure given their birth and death places, alongside the respective years.
              More than {(Math.floor(data.figures.length / 100) * 100).toLocaleString("en")} figures from every era and corner of the world.
            </p>
            <div className="clue-key" aria-label="Map clue key">
              <span><i className="key-ring key-ring--birth" />Birth place + year</span>
              <span><i className="key-ring key-ring--death" />Death place + year</span>
            </div>
          </div>

          <div className="start-panel">
            <h2>Set up a game</h2>
            <div className="difficulty-list" role="radiogroup" aria-label="Difficulty">
              {difficultyOrder.map((level) => {
                const item = difficultyDetails[level];
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={setup.difficulty === level}
                    className={`difficulty-option${setup.difficulty === level ? " is-selected" : ""}`}
                    onClick={() => updateSetup({ difficulty: level })}
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

            <div className="theme-panel">
              <div className="theme-heading">
                <span>Theme</span>
                <button type="button" className="text-action" onClick={surprise}>Surprise me</button>
                {themed.length !== data.figures.length && (
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => updateSetup({ era: "any", field: "any", region: "any" })}
                  >
                    Clear
                  </button>
                )}
              </div>
              <label>
                <span>Era</span>
                <select value={setup.era} onChange={(event) => updateSetup({ era: event.target.value as GameSetup["era"] })}>
                  <option value="any">Any era</option>
                  {eraOrder.map((era) => (
                    <option key={era} value={era} disabled={themeCount({ era }) === 0}>
                      {eraDetails[era].label} ({eraDetails[era].span})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Field</span>
                <select value={setup.field} onChange={(event) => updateSetup({ field: event.target.value as GameSetup["field"] })}>
                  <option value="any">Any field</option>
                  {fieldOrder.map((field) => (
                    <option key={field} value={field} disabled={themeCount({ field }) === 0}>
                      {fieldDetails[field].label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Region</span>
                <select value={setup.region} onChange={(event) => updateSetup({ region: event.target.value as GameSetup["region"] })}>
                  <option value="any">Anywhere</option>
                  {regionOrder.map((region) => (
                    <option key={region} value={region} disabled={themeCount({ region }) === 0}>
                      {worldRegionDetails[region].label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="round-options" role="radiogroup" aria-label="Rounds">
                <span>Rounds</span>
                {ROUND_OPTIONS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    role="radio"
                    aria-checked={setup.rounds === count}
                    className={setup.rounds === count ? "is-selected" : ""}
                    onClick={() => updateSetup({ rounds: count })}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <p className="pool-note" aria-live="polite">
              {pool.length === 0
                ? "No figures match this theme yet. Try widening it."
                : <>
                    <strong>{pool.length.toLocaleString("en")}</strong> figures in this pool
                    {" · "}
                    <strong>{fresh.toLocaleString("en")}</strong> you haven’t met
                    {pool.some((item) => item.recognition !== setup.difficulty) &&
                      " · some borrowed from nearby tiers"}
                  </>}
            </p>

            <button className="primary-action" type="button" disabled={pool.length === 0} onClick={() => startGame()}>
              Start a {rounds}-round game
            </button>
            {savedSession && (
              <button className="text-action resume-action" type="button" onClick={resumeGame}>
                Resume round {savedSession.roundIndex + 1} · {difficultyDetails[savedSession.setup.difficulty].label} · {themeLabel(savedSession.setup)}
              </button>
            )}
            <p className="best-score">
              Best 10-round score on {difficultyDetails[setup.difficulty].label}: <strong>{scores[setup.difficulty]}</strong>
              {seen.size > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => {
                      clearSeen();
                      setSeen(new Map());
                    }}
                  >
                    Forget the {seen.size.toLocaleString("en")} figures I’ve met
                  </button>
                </>
              )}
            </p>
          </div>
        </section>
      </main>,
    );
  }

  if (!session || !figure) return frame(<main className="boot-screen">Choose a game from Play.</main>);

  const setupLabel = `${difficultyDetails[session.setup.difficulty].label} · ${themeLabel(session.setup)}`;

  if (screen === "results") {
    const correct = session.results.filter((result) => result.resolution === "correct").length;
    return frame(
      <main className="results-screen">
        <section className="results-card">
          <p className="kicker">{newBest ? "New best score" : "Expedition complete"}</p>
          <h1>{session.score} points</h1>
          <p className="results-lede">
            You identified {correct} of {session.results.length} historical figures · {setupLabel}.
          </p>
          <div className="results-stats">
            <div><strong>{getAccuracy(session)}%</strong><span>Accuracy</span></div>
            <div><strong>{session.bestStreak}</strong><span>Best streak</span></div>
            <div><strong>{session.results.reduce((sum, item) => sum + item.incorrectGuesses, 0)}</strong><span>Wrong guesses</span></div>
          </div>
          <div className="journey-list">
            {session.results.map((result) => {
              const item = data.byId.get(result.figureId);
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
            <button className="primary-action" type="button" onClick={() => startGame(session.setup)}>Play again</button>
            <button className="secondary-action" type="button" onClick={() => openScreen("home")}>Change setup</button>
          </div>
        </section>
      </main>,
    );
  }

  const currentHints = [
    figure.hints.category,
    `Associated with ${figure.region}`,
    figure.hints.clue,
  ].slice(0, regularHints);
  const tier = difficultyDetails[figure.recognition];

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
          <span className="difficulty-chip" title={themeLabel(session.setup)}>
            {tier.label} · {tier.multiplier}×
          </span>
        </div>
      </header>

      {storageWarning && (
        <div className="storage-warning" role="status">Progress cannot be saved in this browser, but you can keep playing.</div>
      )}

      <section className="play-layout">
        <div className="map-column">
          <GameMap
            figure={figure}
            difficulty={session.setup.difficulty}
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
                <p>{themeLabel(session.setup)}</p>
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
                  {currentHints.map((hint, index) => <p key={index}><b>Hint {index + 1}</b>{hint}</p>)}
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
              <p className="life-dates">{displayYear(figure.birthYear)} – {displayYear(figure.deathYear)}</p>
              <p className="figure-tags">
                <span>{fieldDetails[figure.field].label}</span>
                <span>{eraDetails[figure.era].label}</span>
                <span>{worldRegionDetails[figure.worldRegion].label}</span>
              </p>
              <p className="biography">{figure.biography}</p>
              <dl className="place-details">
                <div><dt>Born</dt><dd>{figure.birthLocation.name}</dd></div>
                <div><dt>Died</dt><dd>{figure.deathLocation.name}</dd></div>
              </dl>
              {figure.sources[0] && (
                <a className="source-link" href={figure.sources[0]} target="_blank" rel="noreferrer">
                  Read more
                </a>
              )}
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
