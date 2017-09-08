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
    this._cachedUserAnswers = {
      all: {},
      css: {},
      js: {}
    };
    this.showingVideo = '';
    this.showingBlackout = false;
    this.showingSplitTracks = false;
    this.showingEndScreen = false;
  }
  get activeQuestions() {
    return this._activeQuestions;
  }
  getActiveQuestion(track = "all") {
    return this._activeQuestions[track] && this._activeQuestions[track].question;
  }
  isAcceptingAnswers(track = "all") {
    return this._activeQuestions[track] && (['acceptingAnswers', 'showingLiveResults'].indexOf(this._activeQuestions[track].stage) > -1);
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
    this._cachedUserAnswers[question.track] = {};
  }
  showLiveResults(track = "all") {
    if (this._activeQuestions[track]) {      
      this._activeQuestions[track].stage = 'showingLiveResults';
    }
  }
  cacheAnswers(userId, answers, track = "all") {
    if (!this._cachedUserAnswers[track][userId]) {
      this._cachedUserAnswers[track][userId] = {};
    }
    this._cachedUserAnswers[track][userId] = answers;
  }
  getAverages(track = "all") {
    if (!!this._activeQuestions[track] && !!this._activeQuestions[track].question){
      let total = 0;
      const occurrences = Array(this._activeQuestions[track].question.answers.length).fill(0);

      for (const userId of Object.keys(this._cachedUserAnswers[track])) {
        total++;
        const choices = this._cachedUserAnswers[track][userId];
        for (const choice of choices) {
          occurrences[choice]++;
        }
      }

      return occurrences.map(n => n/total);      
    }
    return null;
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

  getUsersAnswers(answers){
    const tracks = ['all', 'css', 'js'];
    let answersSubmitted = { all:[], css: [], js: []};
    for(let i=0; i< tracks.length; i++ ){
      let track = tracks[i];
      let userAnswers = {};
      if (!!this._activeQuestions[track] && !!this._activeQuestions[track].question){
        userAnswers[track] = answers.find(a => a.questionId.equals(this._activeQuestions[track].question._id)) || [];
        if (!!userAnswers[track] && !!userAnswers[track].choices) {
          answersSubmitted[track] = this._activeQuestions[track].question.answers.map((_, i) => userAnswers[track].choices.includes(i));
        }
      }
    }
    return answersSubmitted;
  }
  getState() {
    const tracks = ['all', 'css', 'js'];
    const questions = tracks.map(track => this._activeQuestions[track] && this._activeQuestions[track].question && {
      id: this._activeQuestions[track].question._id,
      title: this._activeQuestions[track].question.title,
      text: this._activeQuestions[track].question.text,
      code: this._activeQuestions[track].question.code,
      codeType: this._activeQuestions[track].question.codeType,
      multiple: this._activeQuestions[track].question.multiple,
      scored: this._activeQuestions[track].question.scored,
      track: this._activeQuestions[track].question.track,
      // Don't want to send which answers are correct all the time,
      // see `correctAnswers` below
      answers: this._activeQuestions[track].question.answers.map(answer => ({text: answer.text})),
      questionClosed: ['showingLiveResultsAll', 'revealingAnswers'].indexOf(this._activeQuestions[track].stage) > -1,
      showLiveResults: ['showingLiveResults', 'showingLiveResultsAll', 'revealingAnswers'].indexOf(this._activeQuestions[track].stage) > -1

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
