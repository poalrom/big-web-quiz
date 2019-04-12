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
import uuidV4 from 'uuid/v4';

import { Question, Quiz } from './models';
import { User, naiveLoginAllowed } from '../user/models';
import { longPollers } from '../long-pollers/views';
import EventStream from '../event-stream';

import { getDefaultTracksObject } from '../shared/utils';


export const quiz = new Quiz();
export const presentationListeners = new EventStream();
longPollers.broadcast(quiz.getState());
presentationListeners.broadcast(quiz.getState());


export function adminStateJson(req, res) {
  Question.find().sort({ priority: -1 }).then((questions) => {
    questions = questions.map((q) => q.toObject());
    for (const question of questions) {
      if (quiz.activeQuestions[question.track] && quiz.activeQuestions[question.track].question) {
        question.active = quiz.activeQuestions[question.track].question._id.equals(question._id);
        if (question.active) {
          question.closed = ['showingLiveResultsAll', 'revealingAnswers'].indexOf(quiz.activeQuestions[question.track].stage) > -1;
          question.revealingAnswers = quiz.activeQuestions[question.track].stage === 'revealingAnswers';
          question.showingLiveResults = ['showingLiveResults', 'showingLiveResultsAll', 'revealingAnswers'].indexOf(quiz.activeQuestions[question.track].stage) > -1;
        }
      }
    }
    res.json({
      questions,
      showingLeaderboard: quiz.showingLeaderboard,
      showingVideo: quiz.showingVideo,
      showingBlackout: quiz.showingBlackout,
      showingSplitTracks: quiz.showingSplitTracks,
      showingEndScreen: quiz.showingEndScreen,
      naiveLoginAllowed: naiveLoginAllowed()
    });
  });
}

export function deleteQuestionJson(req, res) {
  Question.findByIdAndRemove(req.body.id).then(() => {
    adminStateJson(req, res);
    return;
  }).catch((err) => {
    res.status(500).json({ err: err.message });
  });
}

function upsertQuestion(data) {
  const update = {
    title: data.title,
    text: data.text,
    code: data.code,
    codeType: data.codeType,
    multiple: !!data.multiple,
    scored: !!data.scored,
    priority: !!data.priority,
    track: data.track,
    answers: data.answers
  };

  if (!Array.isArray(update.answers)) {
    update.answers = [];
  }

  // remove answers without text
  update.answers = update.answers.filter((answer) => String(answer.text).trim());

  if (!update.answers.length) {
    throw Error('No answers provided');
  }

  if (data.key) {
    update.key = data.key;
    return Question.findOneAndUpdate({ key: data.key }, update, { new: true, upsert: true });
  }

  if (data.id) {
    return Question.findByIdAndUpdate(data.id, update, { new: true });
  }

  update.key = uuidV4();

  return new Question(update).save();
}

export function updateQuestionJson(req, res) {
  upsertQuestion(req.body).then((newQuestion) => {
    if (!newQuestion) {
      throw Error('No record found');
    }
    adminStateJson(req, res);
  }).catch((err) => {
    res.status(500).json({ err: err.message });
  });
}

export async function setQuestionJson(req, res) {
  try {
    let question;

    if (req.body.question) {
      question = await upsertQuestion(req.body.question);
    } else {
      question = await Question.findById(req.body.id);
    }

    if (!question) {
      res.status(404).json({ err: 'Question not found' });
      return;
    }

    quiz.setQuestion(question);
    presentationListeners.broadcast(
      Object.assign({
        averages: getDefaultTracksObject(
          quiz.getAverages(),
          quiz.getAverages('css'),
          quiz.getAverages('js'))
      }, quiz.getState())
    );
    longPollers.broadcast(quiz.getState());

    adminStateJson(req, res);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
}

function findQuestion(body) {
  if (body.key) {
    return Question.findOne({ key: body.key });
  }
  return Question.findById(body.id);
}

export function closeQuestionJson(req, res) {
  findQuestion(req.body).then((question) => {
    if (!question) {
      res.status(404).json({ err: 'Question not found' });
      return;
    }

    if (!quiz.activeQuestions[question.track] || !quiz.activeQuestions[question.track].question || !question.equals(quiz.activeQuestions[question.track].question)) {
      res.status(404).json({ err: `This isn't the active ${question.track} question` });
      return;
    }

    quiz.closeForAnswers(question.track);
    presentationListeners.broadcast(quiz.getState());
    longPollers.broadcast(quiz.getState());

    adminStateJson(req, res);
  }).catch((err) => {
    res.status(500).json({ err: err.message });
  });
}

export function revealQuestionJson(req, res) {
  findQuestion(req.body).then((question) => {
    if (!question) {
      res.status(404).json({ err: 'Question not found' });
      return;
    }

    if (!quiz.activeQuestions[question.track] || !quiz.activeQuestions[question.track].question || !question.equals(quiz.activeQuestions[question.track].question)) {
      res.status(404).json({ err: `This isn't the active ${question.track} question` });
      return;
    }

    quiz.revealAnswers(question.track);

    return Question.find();
  }).then((qs) => User.updateScores(qs)).then(() => {
    presentationListeners.broadcast(quiz.getState());
    longPollers.broadcast(quiz.getState());
    adminStateJson(req, res);
  }).catch((err) => {
    res.status(500).json({ err: err.message });
  });
}

export async function deactivateQuestionJson(req, res) {
  try {
    const question = await findQuestion(req.body);

    if (!question) {
      res.status(404).json({ err: 'Question not found' });
      return;
    }

    if (!quiz.activeQuestions[question.track] || !quiz.activeQuestions[question.track].question || !question.equals(quiz.activeQuestions[question.track].question)) {
      res.status(404).json({ err: `This isn't the active ${question.track} question` });
      return;
    }
    quiz.unsetQuestion(question.track);
    presentationListeners.broadcast(quiz.getState());
    longPollers.broadcast(quiz.getState());

    adminStateJson(req, res);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
}

export function liveResultsQuestionJson(req, res) {
  findQuestion(req.body).then((question) => {
    if (!question) {
      res.status(404).json({ err: 'Question not found' });
      return;
    }

    if (!quiz.activeQuestions[question.track] || !quiz.activeQuestions[question.track].question || !question.equals(quiz.activeQuestions[question.track].question)) {
      res.status(404).json({ err: `This isn't the active ${question.track} question` });
      return;
    }

    quiz.showLiveResults(question.track);

    presentationListeners.broadcast(quiz.getState());
    adminStateJson(req, res);
  }).catch((err) => {
    res.status(500).json({ err: err.message });
  });
}

export function showLeaderboardJson(req, res) {
  User.find({
    optIntoLeaderboard: true,
    bannedFromLeaderboard: false
  }).limit(10).sort({ score: -1 }).then((users) => {
    quiz.showLeaderboard();
    presentationListeners.broadcast({
      question: null,
      leaderboard: users.map((user) => {
        return {
          name: user.name,
          avatarUrl: user.avatarUrl,
          score: user.score
        };
      })
    });
    adminStateJson(req, res);
  });
}

export function hideLeaderboardJson(req, res) {
  quiz.hideLeaderboard();
  presentationListeners.broadcast(
    Object.assign({ leaderboard: null }, quiz.getState())
  );
  adminStateJson(req, res);
}

export function showBlackoutJson(req, res) {
  quiz.showingBlackout = true;
  presentationListeners.broadcast(
    Object.assign({ showBlackout: true }, quiz.getState())
  );
  adminStateJson(req, res);
}

export function hideBlackoutJson(req, res) {
  quiz.showingBlackout = false;
  presentationListeners.broadcast(
    Object.assign({ showBlackout: false }, quiz.getState())
  );
  adminStateJson(req, res);
}

export function showSplitTracksJson(req, res) {
  quiz.showingSplitTracks = true;
  presentationListeners.broadcast(
    Object.assign({ showingSplitTracks: true }, quiz.getState())
  );
  longPollers.broadcast(quiz.getState());
  adminStateJson(req, res);
}

export function hideSplitTracksJson(req, res) {
  quiz.showingSplitTracks = false;
  presentationListeners.broadcast(
    Object.assign({ showingSplitTracks: false }, quiz.getState())
  );
  longPollers.broadcast(quiz.getState());
  adminStateJson(req, res);
}

export function showVideoJson(req, res) {
  quiz.showingVideo = String(req.body.video);
  presentationListeners.broadcast(
    Object.assign({ showVideo: quiz.showingVideo }, quiz.getState())
  );
  adminStateJson(req, res);
}

export function setEndScreen(req, res) {
  quiz.showingEndScreen = !!req.body.show;
  longPollers.broadcast(quiz.getState());
  adminStateJson(req, res);
}

export function presentationListen(req, res) {
  presentationListeners.add(req, res);
}