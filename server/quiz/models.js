/**
*
* Copyright 2016 Google Inc. All rights reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import mongoose from '../mongoose-db';

const questionSchema = mongoose.Schema({
  // Human readable ID
  key: {type: String, index: true, unique: true, required: true},
  // Short title of the question, eg "Question 1"
  title: {type: String, required: true, default: "Question!"},
  // The actual question
  text: {type: String, required: true},
  // Answers can optionally have a code example
  code: String,
  // So syntax highlighting can do the right thing
  codeType: String,
  // User can select multiple answers (checkboxes rather than radios)
  multiple: Boolean,
  // Scored? Questions can be non-scored for simple polls
  scored: {type: Boolean, default: true},
  // Shove it to the top of the list in admin view?
  priority: {type: Boolean, default: false, index: true},
  // Array of answers
  answers: [{
    text: {type: String, required: true},
    correct: Boolean
  }],
  // Type of question to split to a few tracks
  track: {
    type: String,
    default: 'all'
  }
});

export const Question = mongoose.model('Question', questionSchema);

export class Quiz {
  constructor() {
    this._activeQuestions = {
      all: null,
      css: null,
      js: null
    };
    this._showingLeaderboard = false;
    this._cachedUserAnswers = {};
    this.showingVideo = '';
    this.showingBlackout = false;
    this.showingSplitTracks = true;
    this.showingEndScreen = false;
  }
  get activeQuestions() {
    return this._activeQuestions;
  }
  getActiveQuestion(track = "all") {
    return this._activeQuestions[track] && this._activeQuestions[track].question;
  }
  getAcceptingAnswers(track = "all") {
    return this._activeQuestions[track] && this._activeQuestions[track].stage == 'acceptingAnswers';
  }
  getRevealingAnswers(track = "all") {
    return this._activeQuestions[track] && this._activeQuestions[track].stage == 'revealingAnswers';
  }
  getShowingLiveResults(track = "all") {
    return this._activeQuestions[track] && this._activeQuestions[track].stage == 'showingLiveResults';
  }
  get showingLeaderboard() {
    return this._showingLeaderboard;
  }
  setQuestion(question) {
    if (!this._activeQuestions[question.track]) this._activeQuestions[question.track] = {};
    this._activeQuestions[question.track].question = question;
    this._activeQuestions[question.track].stage = 'acceptingAnswers';
    this._cachedUserAnswers = {};
  }
  showLiveResults(track = "all") {
    if (this._activeQuestions[track]) {      
      this._activeQuestions[track].stage = 'showingLiveResults';
    }
  }
  cacheAnswers(userId, answers, track = "all") {
    if (!this._cachedUserAnswers[userId]) {
      this._cachedUserAnswers[userId] = {};
    }
    this._cachedUserAnswers[userId][track] = answers;
  }
  getAverages(track = "all") {
    let total = 0;
    const occurrences = Array(this._activeQuestions[track].question.answers.length).fill(0);

    for (const userId of Object.keys(this._cachedUserAnswers)) {
      total++;
      const choices = this._cachedUserAnswers[userId][track];
      for (const choice of choices) {
        occurrences[choice]++;
      }
    }

    return occurrences.map(n => n/total);
  }
  closeForAnswers(track = "all") {
    if (!this._activeQuestions || !this._activeQuestions[track]) throw Error("No active question");
    this._activeQuestions[track].stage = 'showingLiveResultsAll';
    this.showingVideo = '';
  }
  revealAnswers(track = "all") {
    if (!this._activeQuestions || !this._activeQuestions[track]) throw Error("No active question");
    this._activeQuestions[track].stage = 'revealingAnswers';
  }
  unsetQuestion(track = "all") {
    this._activeQuestions[track] = null;
  }
  showLeaderboard() {
    this._showingLeaderboard = true;
    this.showingVideo = '';
  }
  hideLeaderboard() {
    this._showingLeaderboard = false;
  }
  getState() {
    const tracks = ['all', 'css', 'js'];
    const questions = tracks.map(track => this._activeQuestions[track] && {
      id: this._activeQuestions[track]._id,
      title: this._activeQuestions[track].title,
      text: this._activeQuestions[track].text,
      code: this._activeQuestions[track].code,
      codeType: this._activeQuestions[track].codeType,
      multiple: this._activeQuestions[track].multiple,
      scored: this._activeQuestions[track].scored,
      track: this._activeQuestions[track].track,
      // Don't want to send which answers are correct all the time,
      // see `correctAnswers` below
      answers: this._activeQuestions[track].question.answers.map(answer => ({text: answer.text}))
    });
    const correctAnswers = tracks.map(track=> this._activeQuestions[track] && this._activeQuestions[track].question && this._activeQuestions[track].stage == 'revealingAnswers' &&
        this._activeQuestions[track].question.answers.reduce((arr, answer, i) => {
          if (answer.correct) {
            arr.push(i);
          }
          return arr;
        }, [])
    );

    return {
      activeQuestions: {
        all: questions[0],
        css: questions[1],
        js: questions[2]
      },
      showingSplitTracks: this.showingSplitTracks,
      // array of indexes for the correct answers
      correctAnswers: {
        all: correctAnswers[0],
        css: correctAnswers[1],
        js: correctAnswers[2]
      }
    }
  }
}
