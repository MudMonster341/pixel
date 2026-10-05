// "Happy Birthday to You": the traditional tune (public domain, written 1893 as "Good Morning to All"; this is the folk melody
// only, no recording and no arrangement taken from anywhere), as data for tools/make-audio.js synthHappyBirthday() and for
// tests/unit/finale.test.js. Key of C, 3/4: a one-beat pick-up ("Hap-py"), then eight bars.
//
//   pick-up  G G
//   bar 1    A G C        bar 2   B (2 beats) + pick-up G G
//   bar 3    A G D'       bar 4   C' (2 beats) + pick-up G G
//   bar 5    G' E' C'     bar 6   B A, pick-up F' F'
//   bar 7    E' C' D'     bar 8   C' (3 beats, rings out)
//
// Pitches are scientific names (G4 = the G above middle C, C5 = the next C up). A "dotted" pair is 0.75 + 0.25 beat.

const HAPPY_BIRTHDAY_BPM = 108;

const n = (pitch, beats) => ({ pitch, beats });
const HAPPY_BIRTHDAY_TUNE = [
  n('G4', 0.75), n('G4', 0.25), // pick-up: Hap-py
  n('A4', 1), n('G4', 1), n('C5', 1), // birth-day to
  n('B4', 2), n('G4', 0.75), n('G4', 0.25), // you / Hap-py
  n('A4', 1), n('G4', 1), n('D5', 1), // birth-day to
  n('C5', 2), n('G4', 0.75), n('G4', 0.25), // you / Hap-py
  n('G5', 1), n('E5', 1), n('C5', 1), // birth-day dear
  n('B4', 1), n('A4', 1), n('F5', 0.75), n('F5', 0.25), // Ta-ru / Hap-py
  n('E5', 1), n('C5', 1), n('D5', 1), // birth-day to
  n('C5', 3), // you
];

// The bass underneath, one chord per bar after the pick-up: [root, upper note A, upper note B] in Hz ("oom-pah-pah").
const HAPPY_BIRTHDAY_BASS = [
  [130.81, 196.0, 164.81], // bar 1  C
  [98.0, 146.83, 123.47], // bar 2  G
  [98.0, 146.83, 123.47], // bar 3  G
  [130.81, 196.0, 164.81], // bar 4  C
  [130.81, 196.0, 164.81], // bar 5  C
  [87.31, 220.0, 174.61], // bar 6  F
  [98.0, 146.83, 123.47], // bar 7  G
  [130.81, 196.0, 164.81], // bar 8  C
];

const NOTE_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// 'A4' -> 440 Hz (equal temperament).
function noteFreq(pitch) {
  const match = /^([A-G])(\d)$/.exec(pitch);
  if (!match) throw new Error(`happy-birthday: bad pitch "${pitch}"`);
  const semitonesFromA4 = NOTE_SEMITONES[match[1]] + 12 * Number(match[2]) - (9 + 12 * 4);
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

const HAPPY_BIRTHDAY_BEATS = HAPPY_BIRTHDAY_TUNE.reduce((sum, note) => sum + note.beats, 0); // 25
const HAPPY_BIRTHDAY_TAIL_SECONDS = 1.0; // the last chord rings out this long after the final beat

module.exports = { HAPPY_BIRTHDAY_BPM, HAPPY_BIRTHDAY_TUNE, HAPPY_BIRTHDAY_BASS, HAPPY_BIRTHDAY_BEATS, HAPPY_BIRTHDAY_TAIL_SECONDS, noteFreq };
